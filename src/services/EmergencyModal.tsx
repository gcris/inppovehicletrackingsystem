import React from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  MapPin,
  User,
  Clock,
  X,
  MessageCircle,
  Phone,
} from "lucide-react";

interface EmergencyModalProps {
  open: boolean;
  log: any;
  personnel?: any;
  onClose: () => void;
}

export default function EmergencyModal({
  open,
  log,
  personnel,
  onClose,
}: EmergencyModalProps) {
  const navigate = useNavigate();

  if (!open || !log) return null;

  const handleViewMap = () => {
    const isLiveViewMap = location.pathname === "/map";
    if (!isLiveViewMap) navigate("map");
    onClose();
  };

  return (
    <>
      {/* Background */}
      <div className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center">
        <div className="w-[520px] rounded-xl bg-white shadow-2xl overflow-hidden animate-in zoom-in duration-300 text-white">
          {/* Header */}
          <div className="bg-red-700 p-5 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 animate-pulse" />
              <div>
                <p className="text-2xl font-bold">DISTRESS SIGNAL</p>

                <p className="text-sm">Immediate Police Assistance Requested</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="hover:bg-red-800 rounded-full p-2"
            >
              <X />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3">
              <User className="text-blue-600" />

              <div>
                <div className="text-gray-800">Rank/Name of Personnel</div>

                <div className="font-semibold text-lg text-black">
                  {personnel?.rank?.rank_name} {personnel?.fullname}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="text-orange-600" />

              <div>
                <div className="text-gray-800">Date and Time</div>

                <div className="font-semibold text-black">
                  {new Date(log.captured_at).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="text-green-600" />

              <div>
                <div className="text-gray-800">Grid Coordinates</div>

                <div className="font-semibold text-black">
                  {Number(log.latitude).toFixed(6)},{" "}
                  {Number(log.longitude).toFixed(6)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {personnel?.phone_number && (
                <>
                  <a
                    href={`tel:${personnel?.phone_number}`}
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                  >
                    <Phone className="w-5 h-5" />
                    <span>{personnel?.phone_number}</span>
                  </a>
                </>
              )}
              {personnel?.viber_number && (
                <>
                  <a
                    href={`viber://chat?number=${personnel?.viber_number}`}
                    className="flex items-center gap-2 text-purple-600 hover:text-purple-800"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span>{personnel?.viber_number}</span>
                  </a>
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-100 p-5 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg border hover:bg-gray-200 bg-white text-black"
            >
              Dismiss
            </button>

            <button
              onClick={handleViewMap}
              className="px-5 py-2 rounded-lg bg-red-700 text-white hover:bg-red-800"
            >
              View on Map
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
