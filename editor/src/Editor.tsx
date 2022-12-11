import { MapRenderer } from "./utils/MapRenderer";
import { useEffect, useState } from "react";
import Mousetrap from "mousetrap";
import MainMenu from "./MainMenu";

type Props = {
  setLoaded(isLoaded: boolean): void;
  mapRenderer: MapRenderer;
  msgboxShow(title: string, msg: string): void;
};

function Editor(props: Props): JSX.Element {
  const mapRenderer = props.mapRenderer;
  const [eraserMode, setEraserMode] = useState(false);
  // const [paintMode, setPaintMode] = useState(false);
  const [lineMode, setLineMode] = useState(false);
  // const []
  useEffect(() => {
    mapRenderer.setEraserMod(eraserMode);
  }, [eraserMode]);
  useEffect(() => {
    mapRenderer.setLineMod(lineMode);
  }, [lineMode]);

  const [historyStatus, setHistoryStatus] = useState({
    canRedo: false,
    canUndo: false,
  });

  useEffect(() => {
    mapRenderer.registerOnChangeCallback("editor", () => {
      setHistoryStatus({
        canRedo: mapRenderer.historyManager.canRedo(),
        canUndo: mapRenderer.historyManager.canUndo(),
      });
    });
    props.setLoaded(true);

    return function cleanup() {
      mapRenderer.unregisterOnChangeCallback("editor");
    };
  }, []);

  Mousetrap.bind(["mod+z"], (_) => {
    mapRenderer.undo();
  });
  Mousetrap.bind(["mod+shift+z"], (_) => {
    mapRenderer.redo();
  });

  const toolButtons = [
    {
      key: "undo",
      icon: iconUndo,
      clickable: historyStatus.canUndo,
      enabled: false,
      onClick: () => {
        mapRenderer.undo();
      },
    },
    {
      key: "redo",
      icon: iconRedo,
      clickable: historyStatus.canRedo,
      enabled: false,
      onClick: () => {
        mapRenderer.redo();
      },
    },
    null,
    {
      key: "eraser",
      icon: iconEraserSolid,
      clickable: true,
      enabled: eraserMode,
      onClick: () => {
        setEraserMode(!eraserMode);
      },
    },
    // {
    //   icon: iconPaint,
    //   clickable: true,
    //   enabled: paintMode,
    //   onClick: () => {
    //     setPaintMode(!paintMode);
    //   },
    // },
    {
      icon: iconLine,
      clickable: true,
      enabled: lineMode,
      onClick: () => {
        setLineMode(!lineMode);
      },
    },
  ];

  return (
    <>
      <MainMenu mapRenderer={mapRenderer} msgboxShow={props.msgboxShow} />

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
    data-icon="redo"
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
