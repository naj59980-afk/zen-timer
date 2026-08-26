import React, { useState } from 'react'

export default function SMS() {
  const [to, setTo] = useState('')
  const [body, setBody] = useState('')

  const sendSMS = () => {
    // Use sms: intent to open messaging UI; on Android default SMS app can be set to this app
    const encoded = encodeURIComponent(body)
    window.location.href = `sms:${to}?body=${encoded}`
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold">SMS</h2>
      <div className="mt-4">
        <input className="w-full p-3 rounded border" value={to} onChange={(e)=>setTo(e.target.value)} placeholder="Recipient" />
      </div>
      <div className="mt-2">
        <textarea className="w-full p-3 rounded border" rows={6} value={body} onChange={(e)=>setBody(e.target.value)} placeholder="Message body"></textarea>
      </div>
      <div className="mt-4">
        <button onClick={sendSMS} className="px-4 py-2 bg-blue-600 text-white rounded">Send</button>
      </div>
      <p className="mt-4 text-sm text-gray-600">Note: to fully manage SMS threads this app must be set as the default SMS app on Android.</p>
    </div>
  )
}
