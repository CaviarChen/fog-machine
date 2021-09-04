import { Dialog, Transition } from '@headlessui/react'
import { ChangeEvent, Fragment, useRef } from 'react'


type Props = {
    isOpen: boolean,
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
}

export default function MyModal(props: Props) {
    let { isOpen, setIsOpen } = props;

    const fileInput = useRef<HTMLInputElement | null>(null);

    function fileInputOnChange(e: ChangeEvent<HTMLInputElement>) {
        closeModal();
        // TODO: progress bar, error handling
        for (let i=0; i < (e.target.files?.length || 0); i++) {
            let file = e.target.files?.item(i)!;
            let reader = new FileReader();
            reader.readAsArrayBuffer(file);
            reader.onload = (e) => {
                console.log(reader.result);
            }

        }

        console.log(e.target.files);
    }

    function closeModal() {
        setIsOpen(false)
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
                        <Dialog.Overlay className="fixed inset-0" />
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
                                Import data
                            </Dialog.Title>
                            <div className="mt-2">
                                <p className="text-sm text-gray-500">
                                    TODO: description
                                </p>
                            </div>
                            <div className="pt-4">
                                <div className="border-2 border-dashed border-gray-300 border-opacity-100 rounded-lg">
                                    <div className="py-4 w-min mx-auto">
                                        <input id="myInput"
                                            type="file"
                                            ref={fileInput}
                                            style={{ display: 'none' }}
                                            onChange={fileInputOnChange}
                                            multiple
                                        />
                                        <div className="mb-4 whitespace-nowrap">
                                            TODO: drag and drop a folder
                                        </div>
                                        <div className="w-min mx-auto">
                                            <button
                                                type="button"
                                                className="inline-flex justify-center px-4 py-2 text-sm font-medium text-blue-900 bg-blue-100 border border-transparent rounded-md hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500"
                                                onClick={() => {fileInput.current?.click()}}
                                            >
                                                Select
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Transition.Child>
                </div>
            </Dialog>
        </Transition>
    )
}
