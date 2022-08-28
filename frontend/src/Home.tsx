import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Panel, Content, Divider, Stack } from "rsuite";
import EditIcon from "@rsuite/icons/Edit";
import HistoryIcon from "@rsuite/icons/History";
import { IconProps } from "@rsuite/icons/lib/Icon";
import "./Home.css";

function Item(
  title: string,
  Icon: React.FC<IconProps>,
  description: string,
  onClick: () => void
) {
  const [hover, setHover] = useState(false);
  return (
    <Panel
      shaded={hover}
      bordered
      bodyFill
      className="home-item"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Stack spacing={6}>
        <Icon style={{ fontSize: "6em", margin: "20px" }} />
        <Panel header={title}>
          <p>
            <small>{description}</small>
          </p>
        </Panel>
      </Stack>
    </Panel>
  );
}

function Home() {
  const navigate = useNavigate();
  return (
    <Container>
      <Content>
        <div className="home-body">
          <div className="home-title">
            <h1>Fog Machine</h1>
            <h4>A 3rd party extension tool for the app Fog of World</h4>
          </div>

          <Divider />
          {Item(
            "Editor",
            EditIcon,
            "A tool for visualizing and editing the data of Fog of World App.",
            () => {
              location.href = "/editor";
            }
          )}
          {Item(
            "Time Machine",
            HistoryIcon,
            "A service for backup and preserve history of the data of Fog of World App.",
            () => {
              navigate("/time-machine", { replace: false });
            }
          )}
        </div>
      </Content>
    </Container>
  );
}

export default Home;
