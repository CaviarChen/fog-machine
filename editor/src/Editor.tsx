import { ControlMode, MapController } from "./utils/MapController";
import { useEffect, useState } from "react";
import Mousetrap from "mousetrap";
import MainMenu from "./MainMenu";
import FlyToDialog from "./FlyToDialog";

type Props = {
  setLoaded(isLoaded: boolean): void;
  mapController: MapController;
  msgboxShow(title: string, msg: string): void;
};

function Editor(props: Props): JSX.Element {
  const mapController = props.mapController;
  const [controlMode, setControlMode] = useState(ControlMode.View);
  useEffect(() => {
    mapController.setControlMode(controlMode);
  }, [controlMode]);

  const [historyStatus, setHistoryStatus] = useState({
    canRedo: false,
    canUndo: false,
  });

  const [isFlyToDialogOpen, setIsFlyToDialogOpen] = useState(false);

  useEffect(() => {
    mapController.registerOnChangeCallback("editor", () => {
      setHistoryStatus({
        canRedo: mapController.historyManager.canRedo(),
        canUndo: mapController.historyManager.canUndo(),
      });
    });
    props.setLoaded(true);

    return function cleanup() {
      mapController.unregisterOnChangeCallback("editor");
    };
  }, []);

  Mousetrap.bind(["mod+z"], (_) => {
    mapController.undo();
  });
  Mousetrap.bind(["mod+shift+z"], (_) => {
    mapController.redo();
  });

  const toolButtons = [
    {
      key: "undo",
      icon: iconUndo,
      clickable: historyStatus.canUndo,
      enabled: false,
      onClick: () => {
        mapController.undo();
      },
    },
    {
      key: "redo",
      icon: iconRedo,
      clickable: historyStatus.canRedo,
      enabled: false,
      onClick: () => {
        mapController.redo();
      },
    },
    {
      key: "move-map",
      icon: iconFlyTo,
      clickable: true,
      enabled: false,
      onClick: () => {
        setIsFlyToDialogOpen(true);
      },
    },
    null,
    {
      key: "eraser",
      icon: iconEraserSolid,
      clickable: true,
      enabled: controlMode === ControlMode.Eraser,
      onClick: () => {
        if (controlMode === ControlMode.Eraser) {
          setControlMode(ControlMode.View);
        } else {
          setControlMode(ControlMode.Eraser);
        }
      },
    },
    {
      key: "line",
      icon: iconLine,
      clickable: true,
      enabled: controlMode === ControlMode.DrawLine,
      onClick: () => {
        if (controlMode === ControlMode.DrawLine) {
          setControlMode(ControlMode.View);
        } else {
          setControlMode(ControlMode.DrawLine);
        }
      },
    },
    {
      key: "scribble",
      icon: iconScribble,
      clickable: true,
      enabled: controlMode === ControlMode.DrawScribble,
      onClick: () => {
        if (controlMode === ControlMode.DrawScribble) {
          setControlMode(ControlMode.View);
        } else {
          setControlMode(ControlMode.DrawScribble);
        }
      },
    },
  ];

  return (
    <>
      <MainMenu
        mapController={mapController}
        msgboxShow={props.msgboxShow}
        mode="editor"
      />

      <FlyToDialog
        mapController={mapController}
        isOpen={isFlyToDialogOpen}
        setIsOpen={setIsFlyToDialogOpen}
      />

      <div className="absolute bottom-0 pb-4 z-10 pointer-events-none flex justify-center w-full">
        {toolButtons.map((toolButton) =>
          toolButton !== null ? (
            <button
              key={toolButton.key}
              className={
                "flex items-center justify-center mx-2 w-9 h-9 p-2 bg-white shadow rounded-lg hover:bg-gray-200 active:bg-gray-400" +
                (toolButton.enabled ? " ring-4 ring-gray-700" : "") +
                (toolButton.clickable
                  ? " pointer-events-auto"
                  : " text-gray-300 opacity-40")
              }
              onClick={() => {
                if (toolButton.clickable) {
                  toolButton.onClick();
                }
              }}
            >
              {toolButton.icon}
            </button>
          ) : (
            <div
              key="|"
              className={
                "flex items-center justify-center rounded mx-7 w-1 h-9 bg-black shadow"
              }
            ></div>
          )
        )}
      </div>
    </>
  );
}

export default Editor;

const iconEraserSolid = (
  <svg
    aria-hidden="true"
    focusable="false"
    data-prefix="fas"
    data-icon="eraser"
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    className="w-full h-full"
  >
    <path
      fill="currentColor"
      d="M497.941 273.941c18.745-18.745 18.745-49.137 0-67.882l-160-160c-18.745-18.745-49.136-18.746-67.883 0l-256 256c-18.745 18.745-18.745 49.137 0 67.882l96 96A48.004 48.004 0 0 0 144 480h356c6.627 0 12-5.373 12-12v-40c0-6.627-5.373-12-12-12H355.883l142.058-142.059zm-302.627-62.627l137.373 137.373L265.373 416H150.628l-80-80 124.686-124.686z"
    ></path>
  </svg>
);

const iconRedo = (
  <svg
    aria-hidden="true"
    focusable="false"
    data-prefix="fas"
    data-icon="redo"
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    className="w-full h-full"
  >
    <path
      fill="currentColor"
      d="M500.33 0h-47.41a12 12 0 0 0-12 12.57l4 82.76A247.42 247.42 0 0 0 256 8C119.34 8 7.9 119.53 8 256.19 8.1 393.07 119.1 504 256 504a247.1 247.1 0 0 0 166.18-63.91 12 12 0 0 0 .48-17.43l-34-34a12 12 0 0 0-16.38-.55A176 176 0 1 1 402.1 157.8l-101.53-4.87a12 12 0 0 0-12.57 12v47.41a12 12 0 0 0 12 12h200.33a12 12 0 0 0 12-12V12a12 12 0 0 0-12-12z"
    ></path>
  </svg>
);

const iconUndo = (
  <svg
    aria-hidden="true"
    focusable="false"
    data-prefix="fas"
    data-icon="undo"
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    className="w-full h-full"
  >
    <path
      fill="currentColor"
      d="M212.333 224.333H12c-6.627 0-12-5.373-12-12V12C0 5.373 5.373 0 12 0h48c6.627 0 12 5.373 12 12v78.112C117.773 39.279 184.26 7.47 258.175 8.007c136.906.994 246.448 111.623 246.157 248.532C504.041 393.258 393.12 504 256.333 504c-64.089 0-122.496-24.313-166.51-64.215-5.099-4.622-5.334-12.554-.467-17.42l33.967-33.967c4.474-4.474 11.662-4.717 16.401-.525C170.76 415.336 211.58 432 256.333 432c97.268 0 176-78.716 176-176 0-97.267-78.716-176-176-176-58.496 0-110.28 28.476-142.274 72.333h98.274c6.627 0 12 5.373 12 12v48c0 6.627-5.373 12-12 12z"
    ></path>
  </svg>
);

// const iconPaint = <p>P</p>;
const iconLine = (
  <svg
    aria-hidden="true"
    focusable="false"
    data-prefix="fas"
    data-icon="pen-polyline"
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    className="w-full h-full"
  >
    <path
      fill="currentColor"
      d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"
    />
  </svg>
);

const iconScribble = (
  <svg
    aria-hidden="true"
    focusable="false"
    fill="none"
    data-icon="pen-scribble"
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className="w-full h-full"
  >
    {/* License: MIT. Made by halfmage: https://github.com/halfmage/majesticons */}
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M17.586 2a2 2 0 0 1 2.828 0L22 3.586a2 2 0 0 1 0 2.828L20.414 8 16 3.586 17.586 2zm-3 3-5 5A2 2 0 0 0 9 11.414V13a2 2 0 0 0 2 2h1.586A2 2 0 0 0 14 14.414l5-5L14.586 5z"
      clipRule="evenodd"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M6 14H5a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h14a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-4"
    />
  </svg>
);

const iconFlyTo = (
  <svg
    aria-hidden="true"
    focusable="false"
    data-prefix="fas"
    data-icon="fly-to-pin"
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 384 512"
    className="w-full h-full"
  >
    <path
      fill="currentColor"
      d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"
    ></path>
  </svg>
);
