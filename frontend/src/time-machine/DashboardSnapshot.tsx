import { useState, useEffect } from "react";
import moment from "moment";
import {
  Button,
  Table,
  Panel,
  Placeholder,
  ButtonToolbar,
  Tooltip,
  Whisper,
  Tag,
  Notification,
  useToaster,
  Modal,
  Message,
} from "rsuite";
import MoreIcon from "@rsuite/icons/legacy/More";
import Api, { Snapshot } from "./Api";

const { Column, HeaderCell, Cell } = Table;



function DashboardSnapshot() {
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const loadData = async () => {
    const result = await Api.listSnapshots();
    if (result.ok) {
      setSnapshots(result.ok);
    } else {
      console.log(result);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  type PlacementType = 'topStart' | 'topCenter' | 'topEnd' | 'bottomStart' | 'bottomCenter' | 'bottomEnd';


  const placement:PlacementType = 'topCenter';
  const toaster = useToaster();


  const message = (snapId:number) => {
    return(
    <Notification type="warning" header="warning" closable>
      <Modal.Body>This operation cannot be undone,Sure?</Modal.Body>
      <hr />
      <Button
                        size="sm"
                        onClick={async () => {
                          // TODO: Warning
                          const res = await Api.deleteSnapshot(snapId);
                          console.log(res);
                          loadData();
                          toaster.clear();
                          toaster.push((<Message showIcon type='success'>
                            Success！
                          </Message>), { placement });
                        }}
                      >
                        confirm
                      </Button> 
    </Notification>
  );
                      }

  const Detail = () => {
    if (!snapshots) {
      return <Placeholder.Paragraph />;
    } else {
      return (
        <Table data={snapshots} id="table">
          <Column flexGrow={10}>
            <HeaderCell>Date</HeaderCell>
            <Cell>
              {(rawData) => {
                const snapshot = rawData as Snapshot;
                return (
                  <Whisper
                    placement="top"
                    trigger="hover"
                    speaker={
                      <Tooltip>
                        {moment(snapshot.timestamp).format("lll")}
                      </Tooltip>
                    }
                  >
                    <div>{moment(snapshot.timestamp).format("YYYY-MM-DD")}</div>
                  </Whisper>
                );
              }}
            </Cell>
          </Column>

          <Column flexGrow={10}>
            <HeaderCell>Source</HeaderCell>
            <Cell>
              {(rawData) => {
                const snapshot = rawData as Snapshot;
                return (
                  <Tag>{snapshot.sourceKind == "Sync" ? "Sync" : "Upload"}</Tag>
                );
              }}
            </Cell>
          </Column>

          <Column flexGrow={10} verticalAlign="middle">
            <HeaderCell>
              <MoreIcon />
            </HeaderCell>
            <Cell>
              {(rawData) => {
                const snapshot = rawData as Snapshot;
                return (
                  <div style={{ marginTop: "-3px" }}>
                    <ButtonToolbar>
                      <Button
                        size="sm"
                        onClick={() => {
                          location.href =
                            "/editor?viewing-snapshot=" + String(snapshot.id);
                        }}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          const token = await Api.getSnapshotDownloadToken(
                            snapshot.id
                          );
                          if (token.ok) {
                            window.open(
                              Api.backendUrl +
                                "misc/download?token=" +
                                token.ok,
                              "_blank"
                            );
                          } else {
                            //TODO: error handling
                          }
                        }}
                      >
                        Download
                      </Button>
                      <Button size="sm" onClick={() => toaster.push(message(snapshot.id), { placement })}>Delete</Button>
                    </ButtonToolbar>
                  </div>
                );
              }}
            </Cell>
          </Column>
        </Table>
      );
    }
  };

  return (
    <div style={{ marginTop: "2vh" }}>
      <Panel header="Snapshots">
        <Detail />
      </Panel>
    </div>
  );
}

export default DashboardSnapshot;
