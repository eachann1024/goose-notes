import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { SearchProvider } from "@/stores/useSettings";

interface SearchProviderSortableGridProps {
  providers: SearchProvider[];
  toggleSearchProvider: (id: string) => void;
  reorderSearchProviders: (nextIds: string[]) => void;
}

interface ProviderCardProps {
  provider: SearchProvider;
  onToggle: (id: string) => void;
}

function ProviderCard({ provider, onToggle }: ProviderCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: provider.id,
    transition: {
      duration: 140,
      easing: "cubic-bezier(0.2, 0, 0, 1)",
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 transition-all duration-200",
        provider.isEnabled
          ? "border-[hsl(var(--foreground)/0.28)] bg-[hsl(var(--goose-selected-bg))] shadow-[0_0_0_1px_hsl(var(--foreground)/0.16)] dark:border-[hsl(var(--foreground)/0.32)] dark:bg-[hsl(var(--foreground)/0.14)]"
          : "border-transparent bg-[hsl(var(--goose-selected-bg)/0.58)] dark:bg-[hsl(var(--foreground)/0.08)]",
        isDragging && "shadow-md"
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          className="h-7 w-7 shrink-0 cursor-grab rounded-md bg-[hsl(var(--goose-selected-bg)/0.78)] text-muted-foreground transition-colors hover:bg-[hsl(var(--goose-selected-bg))] active:cursor-grabbing"
          {...attributes}
          {...listeners}
          aria-label={`拖拽调整 ${provider.name} 排序`}
        >
          <GripVertical className="h-4 w-4 mx-auto" />
        </button>
        <Label
          htmlFor={`provider-${provider.id}`}
          className="truncate cursor-pointer"
          title={provider.name}
        >
          {provider.name}
        </Label>
      </div>
      <Switch
        id={`provider-${provider.id}`}
        checked={provider.isEnabled ?? false}
        onCheckedChange={() => onToggle(provider.id)}
      />
    </div>
  );
}

function ProviderOverlay({ provider }: { provider: SearchProvider | null }) {
  if (!provider) return null;
  return (
    <div className="flex w-[220px] items-center gap-2 rounded-lg bg-[hsl(var(--goose-selected-bg))] px-3 py-2.5 shadow-lg">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span className="truncate text-sm font-medium">{provider.name}</span>
    </div>
  );
}

export function SearchProviderSortableGrid({
  providers,
  toggleSearchProvider,
  reorderSearchProviders,
}: SearchProviderSortableGridProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  const activeProvider = useMemo(
    () => providers.find((provider) => provider.id === activeId) ?? null,
    [providers, activeId]
  );

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = providers.findIndex((provider) => provider.id === active.id);
    const newIndex = providers.findIndex((provider) => provider.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(providers, oldIndex, newIndex);
    reorderSearchProviders(next.map((provider) => provider.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <SortableContext
        items={providers.map((provider) => provider.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onToggle={toggleSearchProvider}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        <ProviderOverlay provider={activeProvider} />
      </DragOverlay>
    </DndContext>
  );
}
