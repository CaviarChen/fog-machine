import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import React from "react";
import {
  Breadcrumb,
  Container,
  Content,
  Divider,
  Panel,
  PanelGroup,
} from "rsuite";
import "./Home.css";

function Home() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const HelpContent = () => {
    return i18n.language == "zh" ? ChinaContent() : EnglishContent();
  };

  const EnglishContent = () => {
    return (
      <PanelGroup accordion bordered>
        <Panel header="How to get sharing links" defaultExpanded>
          <Container>
            <Content>
              <p>
                Make sure your Fog of World App is syncing with OneDrive and the
                auto sync is on.
              </p>
              <img
                style={{ width: "50%" }}
                src={require("./images/image9.png")}
              />
              <p>
                Getting the share link of the “Fog of World” folder on OneDrive.
                <br />
                We only need read-only access.
                <br />
                There are multiple ways of getting it, for example:
              </p>
              <PanelGroup accordion bordered>
                <Panel header="Get from OneDrive web UI">
                  <p>
                    Find the “Fog of World” Folder, it should be under the “App”
                    folder.
                  </p>

                  <img
                    style={{ width: "50%" }}
                    src={require("./images/image3.png")}
                  />
                  <br />
                  <img
                    style={{ width: "50%" }}
                    src={require("./images/image8.png")}
                  />
                </Panel>
                <Panel header="Get from OneDrive mobile app">
                  <p>
                    Find the “Fog of World” Folder, it should be under the “App”
                    folder.
                  </p>

                  <img
                    style={{ width: "50%" }}
                    src={require("./images/image12.png")}
                  />
                  <br />
                  <img
                    style={{ width: "50%" }}
                    src={require("./images/image13.png")}
                  />
                </Panel>
                <Panel header="Get from Windows">
                  <p>
                    Find the “Fog of World” Folder, it should be under the “App”
                    folder.
                  </p>

                  <img
                    style={{ width: "50%" }}
                    src={require("./images/image2.png")}
                  />
                  <br />
                  <img
                    style={{ width: "50%" }}
                    src={require("./images/image11.png")}
                  />
                </Panel>
              </PanelGroup>
            </Content>
          </Container>
        </Panel>
      </PanelGroup>
    );
  };

  const ChinaContent = () => {
    return (
      <PanelGroup accordion bordered>
        <Panel header="如何获取共享链接" defaultExpanded>
          <Container>
            <Content>
              <p>确保你的世界迷雾 app 与 OneDrive 同步且打开了自动同步。</p>
              <img
                style={{ width: "50%" }}
                src={require("./images/image1.png")}
              />
              <p>
                从OneDrive上取得 “Fog of
                World”目录的共享链接。迷雾机器只需要只读权限。
                <br />
                有多种方式可以获得这个链接，例如：
              </p>
              <PanelGroup accordion bordered>
                <Panel header="从 OneDrive 网页上获取共享链接">
                  <p>在 “应用” 目录中找到 “Fog of World” 目录</p>

                  <img
                    style={{ width: "50%" }}
                    src={require("./images/image10.png")}
                  />
                  <br />
                  <img
                    style={{ width: "50%" }}
                    src={require("./images/image6.png")}
                  />
                </Panel>
                <Panel header="从 OneDrive 手机端获取共享链接">
                  <p>在 “应用” 目录中找到 “Fog of World” 目录</p>

                  <img
                    style={{ width: "50%" }}
                    src={require("./images/image4.png")}
                  />
                  <br />
                  <img
                    style={{ width: "50%" }}
                    src={require("./images/image14.png")}
                  />
                </Panel>
                <Panel header="从 Windows 获取共享链接">
                  <p>在 “应用” 目录中找到 “Fog of World” 目录</p>

                  <img
                    style={{ width: "50%" }}
                    src={require("./images/image7.png")}
                  />
                  <br />
                  <img
                    style={{ width: "50%" }}
                    src={require("./images/image5.png")}
                  />
                </Panel>
              </PanelGroup>
            </Content>
          </Container>
        </Panel>
      </PanelGroup>
    );
  };

  return (
    <Container>
      <Content>
        <div className="time-machine-body">
          <Breadcrumb
            style={{ marginTop: "5vh", marginBottom: "0", fontSize: "19px" }}
          >
            <Breadcrumb.Item
              onClick={() => {
                navigate("/", { replace: false });
              }}
              href="/"
            >
              {t("home-main-title")}
            </Breadcrumb.Item>
            <Breadcrumb.Item active>{t("home-help-title")}</Breadcrumb.Item>
          </Breadcrumb>

          <Divider style={{ marginTop: "1vh" }} />

          <HelpContent />
        </div>
      </Content>
    </Container>
  );
}

export default Home;
