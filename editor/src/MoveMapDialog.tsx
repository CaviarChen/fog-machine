import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState, useEffect } from "react";
import { MapController } from "./utils/MapController";
import { useTranslation } from "react-i18next";

type Props = {
    mapController: MapController;
    isOpen: boolean;
    setIsOpen(isOpen: boolean): void;
};

export default function MoveMapDialog(props: Props): JSX.Element {
    const { t } = useTranslation();
    const { isOpen, setIsOpen, mapController } = props;
    const [coordinates, setCoordinates] = useState("");

    useEffect(() => {
        if (isOpen) {
            const center = mapController.getCenter();
            if (center) {
                setCoordinates(`${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`);
            }
        }
    }, [isOpen, mapController]);

    function closeModal() {
        setIsOpen(false);
    }

    function handleConfirm() {
        const parts = coordinates.split(",").map((s) => parseFloat(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            mapController.flyTo(parts[1], parts[0]);
            closeModal();
        } else {
            // TODO: Show error? For now just do nothing or maybe alert
            alert("Invalid coordinates format. Use: lat, lng");
        }
    }

    return (
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

                    {/* This element is to trick the browser into centering the modal contents. */}
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
                                Move Map
                            </Dialog.Title>
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700">
                                    Coordinates (lat, lng)
                                </label>
                                <input
                                    type="text"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                                    value={coordinates}
                                    onChange={(e) => setCoordinates(e.target.value)}
                                />
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
