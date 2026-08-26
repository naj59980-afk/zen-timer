import React, { useState } from 'react'

export default function Dialer() {
  const [number, setNumber] = useState('')

  const onDigit = (d: string) => setNumber((n) => n + d)
  const onBackspace = () => setNumber((n) => n.slice(0, -1))
  const onCall = () => {
    // Use tel: intent to launch platform call UI; if app is default dialer this will initiate call
    window.location.href = `tel:${number}`
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold">Dialer</h2>
      <div className="mt-4">
        <input
          className="w-full p-3 rounded border"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Enter number"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {['1','2','3','4','5','6','7','8','9','*','0','#'].map((d) => (
          <button key={d} onClick={() => onDigit(d)} className="p-4 bg-gray-100 rounded">
            {d}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        <button onClick={onBackspace} className="px-4 py-2 bg-yellow-200 rounded">Back</button>
        <button onClick={onCall} className="ml-auto px-6 py-2 bg-green-600 text-white rounded">Call</button>
      </div>

      <p className="mt-4 text-sm text-gray-600">Note: the app will request CALL_PHONE / default-dialer role on Android when you use call features.</p>
    </div>
  )
}
