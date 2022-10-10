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
} from "rsuite";
import MoreIcon from "@rsuite/icons/legacy/More";
import Api, { Snapshot } from "./Api";
import { useTranslation } from "react-i18next";

const { Column, HeaderCell, Cell } = Table;

function DashboardSnapshot() {
  const { t } = useTranslation();
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

  const Detail = () => {
    if (!snapshots) {
      return <Placeholder.Paragraph />;
    } else {
      return (
        <Table data={snapshots} id="table">
          <Column flexGrow={10}>
            <HeaderCell>{t("snapshot-table-date")}</HeaderCell>
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
            <HeaderCell>{t("snapshot-table-source")}</HeaderCell>
            <Cell>
              {(rawData) => {
                const snapshot = rawData as Snapshot;
                return (
                  <Tag>
                    {snapshot.sourceKind == "Sync"
                      ? t("snapshot-table-source-sync")
                      : t("snapshot-table-source-upload")}
                  </Tag>
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
                        {t("snapshot-table-view")}
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
                        {t("snapshot-table-download")}
                      </Button>
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
      <Panel header={t("snapshot-table-title")}>
        <Detail />
      </Panel>
    </div>
  );
}

export default DashboardSnapshot;
