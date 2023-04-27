import { MapController } from "./utils/MapController";
import { useEffect, useState } from "react";
import { createMapFromZip } from "./Import";
import TimeMachineApi, { SnapshotInfo } from "./utils/TimeMachineApi";
import moment from "moment";
import MainMenu from "./MainMenu";

type Props = {
  mapController: MapController;
  initialSnapshotId: number;
  setLoaded(isLoaded: boolean): void;
  msgboxShow(title: string, msg: string): void;
};

// User may switch between snapshots a lot and the sansphotId -> data mapping should be immutable.
// So let's cache it.
// TODO: improve caching. e.g. size limit / not in memory / share across sessions
const gloablSnapshotCache: { [key: number]: ArrayBuffer } = {};

function Viewer(props: Props): JSX.Element {
  const mapController = props.mapController;
  const [snapshotId, setSnapshotId] = useState(props.initialSnapshotId);
  const [snapshotInfo, setSnapshotInfo] = useState<SnapshotInfo | null>(null);

  const loadSnapshot = async () => {
    console.log("loading snapshot", snapshotId);
    props.setLoaded(false);
    // TODO: use react router
    history.replaceState({}, "", "?viewing-snapshot=" + String(snapshotId));
    const snapshotInfoRes = await TimeMachineApi.getSnapshotInfo(snapshotId);
    if (!snapshotInfoRes.ok) {
      console.log(snapshotInfoRes);
      props.msgboxShow("error", "error-failed-to-load-snapshot");
      return;
    }
    const snapshotInfo = snapshotInfoRes.ok;

    let snapshot;
    if (gloablSnapshotCache[snapshotInfo.id]) {
      snapshot = gloablSnapshotCache[snapshotInfo.id];
    } else {
      const snapshotRes = await TimeMachineApi.downloadSnapshot(
        snapshotInfo.downloadToken
      );
      if (!snapshotRes.ok) {
        console.log(snapshotInfoRes);
        props.msgboxShow("error", "error-failed-to-load-snapshot");
        return;
      }
      snapshot = snapshotRes.ok;
      gloablSnapshotCache[snapshotInfo.id] = snapshot;
    }
    const map = await createMapFromZip(snapshot);
    mapController.replaceFogMap(map);
    setSnapshotInfo(snapshotInfo);
    props.setLoaded(true);
  };

  useEffect(() => {
    loadSnapshot();
  }, [snapshotId]);

  if (!snapshotInfo) {
    return <></>;
  } else {
    const commonClassName =
      "flex items-center justify-center mx-2 h-9 p-2 bg-white shadow rounded-lg";
    return (
      <>
        <MainMenu
          mapController={mapController}
          msgboxShow={props.msgboxShow}
          mode="viewer"
        />
        {/* TODO show snapshot's note here */}
        <div className="absolute bottom-0 pb-4 z-10 pointer-events-none flex justify-center w-full">
          <button
            className={
              commonClassName +
              " hover:bg-gray-200 active:bg-gray-400 pointer-events-auto text-gray-700 opacity-80" +
              (snapshotInfo.prev != null ? "" : " invisible")
            }
            onClick={() => {
              if (snapshotInfo.prev) {
                setSnapshotId(snapshotInfo.prev.id);
              }
            }}
          >
            {moment(snapshotInfo.prev?.timestamp).format("YYYY-MM-DD") + " <"}
          </button>

          <button
            className={
              commonClassName + " active:bg-gray-400 ring-4 ring-gray-700"
            }
          >
            {moment(snapshotInfo.timestamp).format("YYYY-MM-DD")}
          </button>

          <button
            className={
              commonClassName +
              " hover:bg-gray-200 active:bg-gray-400 pointer-events-auto text-gray-700 opacity-80" +
              (snapshotInfo.next != null ? "" : " invisible")
            }
            onClick={() => {
              if (snapshotInfo.next) {
                setSnapshotId(snapshotInfo.next.id);
              }
            }}
          >
            {"> " + moment(snapshotInfo.next?.timestamp).format("YYYY-MM-DD")}
          </button>
        </div>
      </>
    );
  }
}

export default Viewer;
