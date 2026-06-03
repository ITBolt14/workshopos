// src/pages/Unauthorized.jsx
import { useNavigate } from 'react-router-dom'
import { ShieldX } from 'lucide-react'

export default function Unauthorized() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">

        {/* SECTION: Icon */}
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-8 h-8 text-red-600" />
        </div>

        {/* SECTION: Message */}
        <h1 className="text-2xl font-bold text-gray-900 font-display mb-2">Access Denied</h1>
        <p className="text-gray-500 mb-6">
          You don't have permission to access this page.
          Please contact your administrator.
        </p>

        {/* SECTION: Action */}
        <button onClick={() => navigate('/main')} className="btn-primary">
          Back to Dashboard
        </button>

      </div>
    </div>
  )
}
