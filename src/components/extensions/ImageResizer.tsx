import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useCallback, useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'

export function ImageResizer(props: NodeViewProps) {
  const { node, updateAttributes, selected } = props
  const [resizing, setResizing] = useState(false)
  const [width, setWidth] = useState(node.attrs.width || 'auto')
  const resizeRef = useRef<HTMLDivElement>(null)
  
  // Update local state when node attributes change externally
  useEffect(() => {
    setWidth(node.attrs.width || 'auto')
  }, [node.attrs.width])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setResizing(true)

    const startX = e.clientX
    const startW = resizeRef.current?.offsetWidth || 0

    const onMouseMove = (e: MouseEvent) => {
      const currentX = e.clientX
      const diffX = currentX - startX
      const newWidth = Math.max(100, startW + diffX) // Min width 100px
      
      setWidth(newWidth)
    }

    const onMouseUp = (e: MouseEvent) => {
      e.preventDefault()
      setResizing(false)
      
      const currentX = e.clientX
      const diffX = currentX - startX
      // Final update
      const newWidth = Math.max(100, startW + diffX)
      updateAttributes({ width: newWidth })

      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [updateAttributes])

  return (
    <NodeViewWrapper className={cn(
        "relative flex justify-center group my-4 transition-all", 
        selected ? 'ring-2 ring-primary ring-offset-2 rounded-md' : ''
    )}>
      <div 
        ref={resizeRef}
        className="relative max-w-full"
        style={{ width: width === 'auto' ? 'auto' : `${width}px` }}
      >
        <img
          src={node.attrs.src}
          alt={node.attrs.alt}
          title={node.attrs.title}
          className="rounded-md block max-w-full h-auto"
        />
        
        {/* Resize Handle - visible only on hover or selection */}
        <div
          className={cn(
            "absolute top-0 right-0 w-4 h-full cursor-col-resize flex flex-col justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 hover:bg-black/20 rounded-r-md",
             resizing && "opacity-100 bg-primary/20"
          )}
          onMouseDown={handleMouseDown}
        >
             <div className="w-1 h-8 bg-white/50 rounded-full" />
        </div>
      </div>
    </NodeViewWrapper>
  )
}
