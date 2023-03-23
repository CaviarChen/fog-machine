import { useState, useEffect, useCallback, useRef } from "react";
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
  Notification,
  useToaster,
  Modal,
  Message,
  Stack,
  DatePicker,
  Uploader,
  Form,
  IconButton,
} from "rsuite";
import MoreIcon from "@rsuite/icons/legacy/More";
import Api, { SnapshotList, Snapshot } from "./Api";
import PlusIcon from "@rsuite/icons/Plus";
import { MessageType } from "rsuite/esm/Notification/Notification";
import { useTranslation } from "react-i18next";

const { Column, HeaderCell, Cell } = Table;

type SnapshotListState = {
  currentPage: number;
};

const SnapshotListPanel: React.FC<{
  isLoading: boolean;
  snapshotList: SnapshotList | null;
  snapshotListState: SnapshotListState;
  setSnapshotListState: (state: SnapshotListState) => void;
  openDeleteConfirmation: (snapshotId: number) => void;
}> = ({
  isLoading,
  snapshotList,
  snapshotListState,
  setSnapshotListState,
  openDeleteConfirmation,
}) => {
  const { t } = useTranslation();
  if (!snapshotList) {
    return <Placeholder.Paragraph />;
  } else {
    return (
      <div>
        <Table
          data={snapshotList.snapshots}
          loading={isLoading}
          autoHeight={true}
          id="table"
        >
          <Column flexGrow={10}>
            <HeaderCell>{t("snapshot-list-date")}</HeaderCell>
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
            <HeaderCell>{t("snapshot-list-source")}</HeaderCell>
            <Cell>
              {(rawData) => {
                const snapshot = rawData as Snapshot;
                return (
                  <Tag>
                    {snapshot.sourceKind == "Sync"
                      ? t("snapshot-list-source-sync")
                      : t("snapshot-list-source-upload")}
                  </Tag>
                );
              }}
            </Cell>
          </Column>

          <Column flexGrow={10}>
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
                        {t("snapshot-list-view")}
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
                        {t("snapshot-list-download")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openDeleteConfirmation(snapshot.id)}
                      >
                        {t("snapshot-list-delete")}
                      </Button>
                    </ButtonToolbar>
                  </div>
                );
              }}
            </Cell>
          </Column>
        </Table>
        <hr />
        <Pagination
          layout={["total", "-", "pager", "skip"]}
          size={"xs"}
          prev={true}
          next={true}
          first={true}
          last={true}
          limit={10}
          total={snapshotList.numberOfSnapshots}
          maxButtons={4}
          activePage={snapshotListState.currentPage}
          onChangePage={(page) => {
            setSnapshotListState({
              currentPage: page,
            });
          }}
        />
      </div>
    );
  }
};

function DashboardSnapshot() {
  const timerRef = useRef(0);
  const { t } = useTranslation();
  const [snapshotList, setSnapshotList] = useState<SnapshotList | null>(null);
  const [snapshotListState, setSnapshotListState] = useState<SnapshotListState>(
    {
      currentPage: 1,
    }
  );

  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const result = await Api.listSnapshots(snapshotListState.currentPage, 10);
    if (result.ok) {
      setSnapshotList(result.ok);
    } else {
      console.log(result);
    }
    setIsLoading(false);
  }, [snapshotListState]);

  useEffect(() => {
    loadData();
    // Start polling after 10s
    timerRef.current = window.setInterval(() => {
      loadData();
    }, 10000);
    return () => window.clearInterval(timerRef.current);
  }, [loadData]);

  // TODO: we should have a single global toaster for all notifications
  const notificationToaster = useToaster();

  const notification = (type: MessageType, msg: string) => {
    return (
      <Message showIcon type={type}>
        {msg}
      </Message>
    );
  };

  const openDeleteConfirmation = (snapshotId: number) => {
    // TODO: It is a bit wierd to use `Notifaction` as a modal. Maybe we shoudln't do this, but it works okish for now.
    // e.g. when `Notifaction` is open, user can still click other things on the page.
    //      no easy way to close the current one other than using `clear` which close all things.
    //      We *SHOULDN'T* allow user to open multiple confirmation, that's really confusing.

    const message = (
      <Notification
        type="warning"
        header={t("snapshot-list-delete-title")}
        closable
        duration={0}
      >
        {t("snapshot-list-delete-prompt")}
        <hr />
        <ButtonToolbar style={{ padding: 10 }}>
          <Button
            appearance="primary"
            onClick={async () => {
              notificationToaster.clear();
            }}
          >
            {t("snapshot-list-delete-cancel")}
          </Button>
          <Button
            color="red"
            appearance="primary"
            onClick={async () => {
              notificationToaster.clear();
              const res = await Api.deleteSnapshot(snapshotId);
              // TODO: Error handling
              if (res.ok) {
                notificationToaster.push(
                  notification("success", t("success-title")),
                  {
                    placement: "topCenter",
                  }
                );
                loadData();
              } else {
                console.log(res);
              }
            }}
          >
            {t("snapshot-list-delete-confirm")}
          </Button>
        </ButtonToolbar>
      </Notification>
    );
    notificationToaster.push(message, {
      placement: "topCenter",
    });
  };

  const fileUploadUrl = Api.backendUrl + "misc/upload";
  const headers = Api.tokenHeaders();

  type UploadDialogState = {
    uploadDate: Date | null;
    uploadState: "empty" | "uploading" | { token: string };
  };
  const [uploadDialogState, setUploadDialogState] = useState<
    UploadDialogState | "closed"
  >("closed");

  return (
    <div style={{ marginTop: "2vh" }}>
      <Panel
        header={
          <Stack justifyContent="space-between">
            <span>{t("snapshot-list-title")}</span>
            <IconButton
              icon={<PlusIcon />}
              onClick={() => {
                setUploadDialogState({
                  uploadDate: null,
                  uploadState: "empty",
                });
              }}
            >
              {t("snapshot-list-upload")}
            </IconButton>
          </Stack>
        }
      >
        <SnapshotListPanel
          {...{
            isLoading,
            snapshotList,
            snapshotListState,
            setSnapshotListState,
            openDeleteConfirmation,
          }}
        />
      </Panel>

      <Modal
        open={uploadDialogState != "closed"}
        onClose={() => {
          setUploadDialogState("closed");
        }}
        backdrop={"static"}
      >
        <Modal.Header>
          <Modal.Title>{t("data-upload-title")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <DatePicker
              format="yyyy-MM-dd HH:mm"
              size="lg"
              placeholder={t("data-upload-select-date")}
              onChange={(date) => {
                if (uploadDialogState == "closed") return;
                setUploadDialogState({
                  ...uploadDialogState,
                  uploadDate: date,
                });
              }}
              style={{ width: 200, display: "block", marginBottom: 10 }}
            />

            {/*
            TODO: `Uploader` will send the upload request directly. So the file will be uploaded when the user selected the file not when they click the submit button.
            I guess this is fine except that `upload_token` is only valid for 1 min, so if the user click submit after 1 min then this is not going to work.
             */}
            <Uploader
              action={fileUploadUrl}
              headers={headers}
              disableMultipart={true}
              multiple={false}
              disabled={
                uploadDialogState == "closed" ||
                uploadDialogState.uploadState != "empty"
              }
              accept=".zip"
              onUpload={(_files) => {
                if (uploadDialogState == "closed") return;
                setUploadDialogState({
                  ...uploadDialogState,
                  uploadState: "uploading",
                });
              }}
              onRemove={(_file) => {
                if (uploadDialogState == "closed") return;
                setUploadDialogState({
                  ...uploadDialogState,
                  uploadState: "empty",
                });
              }}
              onError={(res, files) => {
                console.log(files);
                console.log(res);
                if (uploadDialogState == "closed") return;
                setUploadDialogState({
                  ...uploadDialogState,
                  uploadState: "empty",
                });
                notificationToaster.push(
                  notification("error", t("error-title"))
                );
              }}
              onSuccess={(res) => {
                if (uploadDialogState == "closed") return;
                setUploadDialogState({
                  ...uploadDialogState,
                  uploadState: { token: res.upload_token },
                });
              }}
              draggable
            >
              <div
                style={{
                  height: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span>
                  {uploadDialogState == "closed" ||
                  uploadDialogState.uploadState == "empty"
                    ? t("data-upload-prompt")
                    : uploadDialogState.uploadState == "uploading"
                    ? t("data-upload-uploading")
                    : t("data-upload-success")}
                </span>
              </div>
            </Uploader>

            <Modal.Footer style={{ marginTop: "16px" }}>
              <Form.Group>
                <ButtonToolbar>
                  <Button
                    disabled={
                      uploadDialogState == "closed" ||
                      !uploadDialogState.uploadDate ||
                      uploadDialogState.uploadState == "empty" ||
                      uploadDialogState.uploadState == "uploading"
                    }
                    type="submit"
                    appearance="primary"
                    onClick={async () => {
                      if (
                        uploadDialogState == "closed" ||
                        !uploadDialogState.uploadDate ||
                        uploadDialogState.uploadState == "empty" ||
                        uploadDialogState.uploadState == "uploading"
                      )
                        return;

                      const result = await Api.uploadSnapshot(
                        uploadDialogState.uploadDate,
                        uploadDialogState.uploadState.token
                      );
                      if (result.ok) {
                        notificationToaster.push(
                          notification("success", t("success-title"))
                        );
                        setUploadDialogState("closed");
                        loadData();
                      } else {
                        console.log(result);
                        let errorMessage = t("error-unknown");
                        if (result.error == "timestamp_is_in_future") {
                          errorMessage = t("error-upload-timestamp");
                        } else if (result.error == "invalid_upload_token") {
                          errorMessage = t("error-upload-token");
                          // TODO: We should reset the `Uploader` here, but currently this cannot be done because
                          // the way we use the `Uploader` is wrong.
                          // We should: not maintaing our own upload status and use `fileList`.
                          // see this example: https://rsuitejs.com/components/uploader/#controlled
                        }
                        notificationToaster.push(
                          notification("error", errorMessage)
                        );
                      }
                    }}
                  >
                    {t("data-form-submit")}
                  </Button>
                </ButtonToolbar>
              </Form.Group>
            </Modal.Footer>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default DashboardSnapshot;
