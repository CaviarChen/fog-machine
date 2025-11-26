import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState, useEffect } from "react";
import { MapController } from "./utils/MapController";
import UrlParserDialog from "./UrlParserDialog";

type Props = {
  mapController: MapController;
  isOpen: boolean;
  setIsOpen(isOpen: boolean): void;
};

export default function FlyToDialog(props: Props): JSX.Element {
  const { isOpen, setIsOpen, mapController } = props;
  const [coordinates, setCoordinatesState] = useState("");
  const [coordError, setCoordError] = useState("");
  const [isUrlParserOpen, setIsUrlParserOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const center = mapController.getCenter();
      if (center) {
        setCoordinates(
          `${center.lat.toFixed(6)}, ${center.lng.toFixed(
            6
          )}, ${center.zoom.toFixed(2)}`
        );
      }
    }
  }, [isOpen, mapController]);

  function closeModal() {
    setIsOpen(false);
  }

  function validateCoordinates(val: string): boolean {
    if (!val.trim()) return false;
    const parts = val.split(",");
    if (parts.length < 2 || parts.length > 3) return false;
    // Regex for integer or decimal, no scientific notation, no letters
    const numRegex = /^-?\d+(\.\d+)?$/;
    return parts.every((part) => numRegex.test(part.trim()));
  }

  function setCoordinates(val: string) {
    setCoordinatesState(val);
    if (!val) {
      setCoordError("");
      return;
    }
    if (validateCoordinates(val)) {
      setCoordError("");
    } else {
      setCoordError(
        "Invalid format. Must be 'lat, lng' or 'lat, lng, zoom'. Numbers only."
      );
    }
  }

  function handleConfirm() {
    const parts = coordinates.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const lat = parts[0];
      const lng = parts[1];
      const zoom = parts.length >= 3 ? parts[2] : undefined;
      mapController.flyTo(lng, lat, zoom);
      closeModal();
    } else {
      setCoordError("Invalid coordinates format. Use: lat, lng, zoom");
    }
  }

  function handleUrlParserConfirm(lat: number, lng: number, zoom?: number) {
    mapController.flyTo(lng, lat, zoom);
    setIsUrlParserOpen(false);
    closeModal();
  }

  return (
    <>
      {/* Main Dialog */}
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog
          as="div"
          className="fixed inset-0 z-40 overflow-y-auto"
          onClose={closeModal}
        >
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />
            </Transition.Child>

            <span
              className="inline-block h-screen align-middle"
              aria-hidden="true"
            >
              &#8203;
            </span>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900"
                >
                  Fly to
                </Dialog.Title>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Coordinates (lat, lng, zoom)
                  </label>
                  <input
                    type="text"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                    value={coordinates}
                    onChange={(e) => setCoordinates(e.target.value)}
                  />
                  {coordError && (
                    <p className="mt-2 text-sm text-red-600">{coordError}</p>
                  )}
                </div>

                <div className="mt-6 flex justify-between items-center">
                  <button
                    type="button"
                    className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500"
                    onClick={() => setIsUrlParserOpen(true)}
                  >
                    URL Parser
                  </button>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                      onClick={handleConfirm}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500"
                      onClick={closeModal}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* URL Parser Dialog */}
      <UrlParserDialog
        isOpen={isUrlParserOpen}
        setIsOpen={setIsUrlParserOpen}
        onConfirm={handleUrlParserConfirm}
      />
    </>
  );
}
