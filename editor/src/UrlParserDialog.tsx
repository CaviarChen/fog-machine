import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";
import { parseMapUrl } from "./utils/MapUrlUtils";

type Props = {
  isOpen: boolean;
  setIsOpen(isOpen: boolean): void;
  onConfirm(lat: number, lng: number, zoom?: number): void;
};

export default function UrlParserDialog(props: Props): JSX.Element {
  const { isOpen, setIsOpen, onConfirm } = props;
  const [urlInput, setUrlInput] = useState("");
  const [urlError, setUrlError] = useState("");
  const [parsedResult, setParsedResult] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
  } | null>(null);

  function handleUrlInputChange(val: string) {
    setUrlInput(val);
    if (!val) {
      setUrlError("");
      setParsedResult(null);
      return;
    }

    const parsed = parseMapUrl(val);
    if (parsed) {
      setParsedResult(parsed);
      setUrlError("");
    } else {
      setParsedResult(null);
      setUrlError("Could not parse URL. Please check the format.");
    }
  }

  function handleConfirm() {
    if (parsedResult) {
      onConfirm(parsedResult.lat, parsedResult.lng, parsedResult.zoom);
      closeModal();
    } else if (urlInput) {
      // Try parsing again just in case
      const parsed = parseMapUrl(urlInput);
      if (parsed) {
        onConfirm(parsed.lat, parsed.lng, parsed.zoom);
        closeModal();
      } else {
        // If invalid, behave like Cancel (close parser, clear state)
        closeModal();
      }
    }
  }

  function closeModal() {
    setIsOpen(false);
    setUrlInput("");
    setUrlError("");
    setParsedResult(null);
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-50 overflow-y-auto"
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
                URL Parser
              </Dialog.Title>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">
                  Paste URL
                </label>
                <input
                  type="text"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  value={urlInput}
                  onChange={(e) => handleUrlInputChange(e.target.value)}
                  placeholder="https://..."
                />
                <p className="mt-2 text-xs text-gray-500">
                  Supports Google Maps, Apple Maps, OpenStreetMap, Bing Maps.
                </p>
                {parsedResult && (
                  <div className="mt-2 text-sm text-green-600">
                    Parsed: {parsedResult.lat.toFixed(6)},{" "}
                    {parsedResult.lng.toFixed(6)}
                    {parsedResult.zoom !== undefined
                      ? `, Zoom: ${parsedResult.zoom}`
                      : ""}
                  </div>
                )}
                {urlError && (
                  <p className="mt-2 text-sm text-red-600">{urlError}</p>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
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
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
