import type { Dispatch, SetStateAction } from 'react';

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEdit: boolean;
  newEvent: {
    title: string;
    start: string;
    end: string;
    category: string;
  };
  setNewEvent: Dispatch<SetStateAction<{
    title: string;
    start: string;
    end: string;
    category: string;
  }>>;
  onSubmit: () => void;
  onDelete: () => void;
  saving?: boolean;
 }
 
 
 export default function AddEventModal({
  isOpen,
  onClose,
  isEdit,
  newEvent,
  setNewEvent,
  onSubmit,
  onDelete,
  saving = false
 }: AddEventModalProps) {
  if (!isOpen) return null;
 
 
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-40 z-40"
        onClick={onClose}
      />
 
 
      {/* Modal container */}
      <div className="fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center z-50">
        <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-2xl shadow-lg p-6 transition-transform transform sm:translate-y-0 translate-y-0 animate-slide-up">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">
              {isEdit ? "Modifier l'événement" : "Ajouter un événement"}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-black text-2xl font-bold"
            >
              ✕
            </button>
          </div>
 
 
          <input
            type="text"
            placeholder="Titre de l'événement"
            value={newEvent.title}
            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
            className="w-full px-4 py-2 border rounded-md mb-3"
          />
 
 
          <div className="mb-3">
            <label className="block text-sm mb-1">Début :</label>
            <input
              type="datetime-local"
              value={newEvent.start}
              onChange={(e) => setNewEvent({ ...newEvent, start: e.target.value })}
              className="w-full px-4 py-2 border rounded-md"
            />
          </div>
 
 
          <div className="mb-3">
            <label className="block text-sm mb-1">Fin :</label>
            <input
              type="datetime-local"
              value={newEvent.end}
              onChange={(e) => setNewEvent({ ...newEvent, end: e.target.value })}
              className="w-full px-4 py-2 border rounded-md"
            />
          </div>
 
 
          <div className="mb-4">
            <label className="block text-sm mb-1">Catégorie :</label>
            <select
              value={newEvent.category}
              onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
              className="w-full px-4 py-2 border rounded-md"
            >
              <option value="volailles">Volailles</option>
              <option value="aquaponie">Aquaponie</option>
              <option value="cultures">Cultures</option>
              <option value="ovins">Ovins</option>
              <option value="administratif">Administratif</option>
            </select>
          </div>
 
 
          <div className="flex justify-between items-center pt-2">
            {isEdit && (
              <button
                onClick={onDelete}
                disabled={saving}
                className="text-red-600 hover:underline text-sm"
              >
                {saving ? "..." : "Supprimer"}
              </button>
            )}
            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Annuler
              </button>
              <button
                onClick={onSubmit}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-60"
              >
                {saving ? "Enregistrement..." : isEdit ? "Modifier" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
 }
 
 
 
 
