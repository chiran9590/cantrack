import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function QR({ text, size = 96 }: { text: string; size?: number }) {
  const [svg, setSvg] = useState('')
  useEffect(() => { QRCode.toString(text, { type: 'svg', margin: 0 }).then(setSvg) }, [text])
  return <div className="bg-white p-1.5 rounded [&>svg]:w-full [&>svg]:h-full" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />
}
