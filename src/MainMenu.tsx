import { Popover, Transition } from "@headlessui/react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/solid";
import { Fragment } from "react";

export enum Actions {
  Import,
}

type Props = {
  onAction(action: Actions): void;
};

const menuItems = [
  {
    name: "Import",
    description: "Import data from [Fog of World]",
    action: Actions.Import,
    icon: IconImport,
  },
];

export default function MainMenu(props: Props): JSX.Element {
  return (
    <div className="absolute z-40 top-4 left-4">
      <div className="max-w-sm m-auto bg-white bg-opacity-90 rounded-xl shadow-md flex items-center space-x-4">
        <Popover className="relative">
          {({ open }) => (
            <>
              <Popover.Button
                className={`
                ${open ? "" : "text-opacity-90"}
                text-black group bg-orange-700 px-3 py-2 rounded-md inline-flex items-center text-base font-medium hover:text-opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75`}
              >
                <div className="p-0.5">
                  <span>FogMachine</span>
                </div>
                {open ? (
                  <ChevronUpIcon
                    className="ml-2 h-5 w-5 text-orange-300 group-hover:text-opacity-80 transition ease-in-out duration-150"
                    aria-hidden="true"
                  />
                ) : (
                  <ChevronDownIcon
                    className="ml-2 h-5 w-5 text-orange-300 group-hover:text-opacity-80 transition ease-in-out duration-150"
                    aria-hidden="true"
                  />
                )}
              </Popover.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <Popover.Panel className="absolute z-10 w-screen max-w-sm mt-3 transform lg:max-w-3xl">
                  <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black ring-opacity-5">
                    <div className="relative grid gap-8 bg-white p-7 lg:grid-cols-2">
                      {menuItems.map((item) => (
                        <a
                          key={item.name}
                          onClick={() => props.onAction(item.action)}
                          href="##"
                          className="flex items-center p-2 -m-3 transition duration-150 ease-in-out rounded-lg hover:bg-gray-50 focus:outline-none focus-visible:ring focus-visible:ring-orange-500 focus-visible:ring-opacity-50"
                        >
                          <div className="flex items-center justify-center flex-shrink-0 w-10 h-10 text-white sm:h-12 sm:w-12">
                            <item.icon aria-hidden="true" />
                          </div>
                          <div className="ml-4">
                            <p className="text-sm font-medium text-gray-900">
                              {item.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {item.description}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>
      </div>
    </div>
  );
}

function IconImport() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="8" fill="#FFEDD5" />
      <svg
        x="7"
        y="7"
        width="34"
        height="34"
        aria-hidden="true"
        focusable="false"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
      >
        <path
          fill="#FDBA74"
          d="M16 288c-8.8 0-16 7.2-16 16v32c0 8.8 7.2 16 16 16h112v-64zm489-183L407.1 7c-4.5-4.5-10.6-7-17-7H384v128h128v-6.1c0-6.3-2.5-12.4-7-16.9zm-153 31V0H152c-13.3 0-24 10.7-24 24v264h128v-65.2c0-14.3 17.3-21.4 27.4-11.3L379 308c6.6 6.7 6.6 17.4 0 24l-95.7 96.4c-10.1 10.1-27.4 3-27.4-11.3V352H128v136c0 13.3 10.7 24 24 24h336c13.3 0 24-10.7 24-24V160H376c-13.2 0-24-10.8-24-24z"
        />
      </svg>
    </svg>
  );
}
