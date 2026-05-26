import { motion, useAnimation, useMotionValue, PanInfo } from 'framer-motion'
import { ReactNode } from 'react'
import { Check, CheckCheck, Trash2 } from 'lucide-react'

interface SwipeableItemProps {
  children: ReactNode
  onRead?: () => void
  onDelete?: () => void
  isRead?: boolean
  onClick?: () => void
  className?: string
  innerClassName?: string
}

export default function SwipeableItem({ 
  children, 
  onRead, 
  onDelete, 
  isRead, 
  onClick,
  className = '',
  innerClassName = ''
}: SwipeableItemProps) {
  const controls = useAnimation()
  const x = useMotionValue(0)

  const handleDragEnd = (e: any, info: PanInfo) => {
    // Add velocity check for natural flick gestures
    if (info.offset.x < -40 || info.velocity.x < -500) {
      controls.start({ x: -150, transition: { type: "spring", stiffness: 300, damping: 25 } })
    } else {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } })
    }
  }

  const handleClick = () => {
    // If it's swiped open, close it on click. Otherwise, trigger onClick.
    if (x.get() < -10) {
      controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } })
    } else if (onClick) {
      onClick()
    }
  }

  return (
    <div className={`relative overflow-hidden group border-b border-gray-50/50 ${className}`}>
      {/* Background Actions */}
      <div className="absolute inset-y-0 right-0 flex items-center z-0">
        {onRead && (
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              onRead(); 
              controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } }); 
            }} 
            className="w-[75px] h-full flex flex-col items-center justify-center bg-blue-50/80 text-blue-600 hover:bg-blue-100 transition-colors border-l border-blue-100/50"
          >
            {isRead ? <CheckCheck size={18} /> : <Check size={18} />}
            <span className="text-[10px] mt-1 font-semibold leading-tight text-center px-1">{isRead ? 'Read' : 'Mark as Read'}</span>
          </button>
        )}
        {onDelete && (
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              onDelete(); 
              controls.start({ x: 0, transition: { type: "spring", stiffness: 300, damping: 25 } });
            }} 
            className="w-[75px] h-full flex flex-col items-center justify-center bg-red-50/80 text-red-600 hover:bg-red-100 transition-colors border-l border-red-100/50"
          >
            <Trash2 size={18} />
            <span className="text-[10px] mt-1 font-semibold">Delete</span>
          </button>
        )}
      </div>

      {/* Foreground swiped area */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -150, right: 0 }}
        dragElastic={0.15}
        dragDirectionLock
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ x }}
        onClick={handleClick}
        className={`relative z-10 w-full cursor-pointer ${innerClassName}`}
      >
        {children}
      </motion.div>
    </div>
  )
}
