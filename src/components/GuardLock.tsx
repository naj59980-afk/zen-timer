import React, { useEffect, useState } from 'react'

export default function GuardLock({ active, onUnlock }: { active: boolean; onUnlock: ()=>void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  // For demo: hardcoded short PIN = 1234; production should use secure keystore
  const SHORT_PIN = '1234'

  useEffect(()=>{
    if(!active){
      setPin('')
      setError('')
    }
  },[active])

  const submit = () => {
    if(pin === SHORT_PIN) {
      onUnlock()
    } else {
      setError('Incorrect PIN')
    }
  }

  if(!active) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded w-full max-w-sm">
        <h3 className="text-lg font-semibold">App is locked</h3>
        <p className="text-sm text-gray-600 mt-2">Enter your short PIN to exit or pause leisure.</p>
        <input className="w-full mt-4 p-2 border rounded" value={pin} onChange={(e)=>setPin(e.target.value)} type="password" />
        {error && <div className="text-red-600 mt-2">{error}</div>}
        <div className="mt-4 flex justify-end">
          <button onClick={submit} className="px-4 py-2 bg-blue-600 text-white rounded">Unlock</button>
        </div>
      </div>
    </div>
  )
}
