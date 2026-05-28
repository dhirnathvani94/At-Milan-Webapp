import React, { useEffect, useRef } from 'react'

export type ProfileStatus = "active" | "yellow" | "red" | "engaged" | "married"

interface ProfilePhotoFrameProps {
  photoUrl: string
  status: ProfileStatus
  size?: number            // diameter in px, default 96
  className?: string
  alt?: string
}

const STATUS_CONFIG: Record<ProfileStatus, {
  color: string
  label: string
  badge: string | null
}> = {
  active:  { color: "#10b981", label: "ACTIVELY LOOKING", badge: null },
  yellow:  { color: "#fbbf24", label: "TAKING A BREAK",   badge: null },
  red:     { color: "#ef4444", label: "PAUSED PROFILE",   badge: null },
  engaged: { color: "#f59e0b", label: "ENGAGEMENT CONFIRMED", badge: "💍" },
  married: { color: "#f59e0b", label: "MARRIAGE CONFIRMED",   badge: "💛💛" },
}

export default function ProfilePhotoFrame({
  photoUrl, status, size = 96, className = "", alt = "Profile"
}: ProfilePhotoFrameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active

  const draw = () => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const S = size
    canvas.width = S * dpr
    canvas.height = S * dpr
    canvas.style.width = S + "px"
    canvas.style.height = S + "px"
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, S, S)

    const cx = S / 2, cy = S / 2
    // Thinner, professional border width (14% instead of 18%) to avoid cropping the face
    const borderW = Math.max(10, S * 0.14)
    
    // The frame sits exactly at the outer boundary of the canvas
    const frameR = S / 2 - borderW / 2 - 1
    
    // The photo is scaled down to sit completely inside the frame (with a 2px gap)
    const photoR = S / 2 - borderW - 3

    // 1. Draw photo as full circle (scaled down so it is NOT overlapped)
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, photoR, 0, Math.PI * 2)
    ctx.clip()
    if (img && img.complete && img.naturalWidth > 0) {
      // Draw image to perfectly fit the smaller photoR circle
      ctx.drawImage(img, cx - photoR, cy - photoR, photoR * 2, photoR * 2)
    } else {
      ctx.fillStyle = "#e5e7eb"
      ctx.fill()
    }
    ctx.restore()

    // 2. Draw colored bottom-left arc (swoosh) completely OUTSIDE the photo
    // Angles: 27 degrees (bottom-right) to 207 degrees (top-left)
    const arcAngleStart = Math.PI * 0.15
    const arcAngleEnd   = Math.PI * 1.15
    
    // Draw the actual colored frame (no white stroke needed as photo is smaller)
    ctx.beginPath()
    ctx.arc(cx, cy, frameR, arcAngleStart, arcAngleEnd)
    ctx.lineWidth = borderW
    ctx.strokeStyle = config.color
    ctx.lineCap = "round"
    ctx.stroke()

    // 3. Draw curved text label using precise proportional kerning
    if (S >= 60) {
      const labelText = config.label
      const fontSize = Math.max(8, Math.floor(borderW * 0.65))
      ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      const totalArcAngle = arcAngleEnd - arcAngleStart
      
      // Calculate precise text width for proportional spacing
      let totalTextWidth = 0
      const chars = labelText.split("")
      const charWidths = chars.map(char => {
        const w = ctx.measureText(char).width
        totalTextWidth += w
        return w
      })

      const letterSpacing = fontSize * 0.12
      const totalWidthWithSpacing = totalTextWidth + letterSpacing * (chars.length - 1)
      const textSpanAngle = totalWidthWithSpacing / frameR
      
      // Center the text mathematically in the available arc
      let currentAngle = arcAngleEnd - (totalArcAngle - textSpanAngle) / 2
      
      ctx.fillStyle = "#ffffff"
      chars.forEach((char, i) => {
        const w = charWidths[i]
        // Find exact center angle for this specific character
        const charCenterAngle = currentAngle - (w / 2) / frameR
        
        const x = cx + frameR * Math.cos(charCenterAngle)
        const y = cy + frameR * Math.sin(charCenterAngle)
        
        ctx.save()
        ctx.translate(x, y)
        // Rotate so the top of the text points towards the center
        ctx.rotate(charCenterAngle - Math.PI / 2)
        ctx.fillText(char, 0, 0)
        ctx.restore()
        
        // Advance angle by the exact width of the current character plus spacing
        currentAngle -= (w + letterSpacing) / frameR
      })
    }

    // 4. Draw badge at top-right for engaged/married
    if (config.badge && S >= 48) {
      const badgeSize = Math.max(14, S * 0.22)
      const badgeX = cx + S * 0.35
      const badgeY = cy - S * 0.35
      ctx.font = `${Math.floor(badgeSize * 0.7)}px serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      
      // Draw small circle background for badge to pop
      ctx.beginPath()
      ctx.arc(badgeX, badgeY, badgeSize * 0.6, 0, Math.PI * 2)
      ctx.fillStyle = "#ffffff"
      ctx.fill()
      
      ctx.fillText(config.badge, badgeX, badgeY)
    }
  }

  useEffect(() => {
    const img = new Image()
    let errorFired = false
    img.onload = () => {
      if (imgRef.current) imgRef.current.src = img.src
      draw()
    }
    img.onerror = () => { 
      if (!errorFired && photoUrl) {
        errorFired = true
        img.src = "https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg"
      } else {
        draw()
      }
    }
    img.src = photoUrl || "https://img.freepik.com/premium-vector/man-avatar-profile-picture-vector-illustration_268834-541.jpg"
    imgRef.current = img
  }, [photoUrl, status, size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ borderRadius: "50%", display: "block" }}
      aria-label={alt}
    />
  )
}
