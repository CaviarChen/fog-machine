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
  Pagination,
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

  const [activePage, setActivePage] = useState(1);

  const Detail = () => {
    if (!snapshots) {
      return <Placeholder.Paragraph />;
    } else {
      return (
        <div>
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
                    </ButtonToolbar>
                  </div>
                );
              }}
            </Cell>
          </Column>
          
        </Table>
          <Pagination
        layout={['total', '-', '|', 'pager', 'skip']}
        size={'xs'}
        prev={true}
        next={true}
        first={true}
        last={true}
        ellipsis={true}
        boundaryLinks={true}
        total={snapshots.length}
        limit={10}
        // limitOptions={limitOptions}
        maxButtons={5}
        activePage={activePage}
        onChangePage={setActivePage}
        // onChangeLimit={setLimit}
      />
        </div>
      
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
