import { Text, Button, Group, Popover, Stack, Loader } from "@mantine/core";
import { TAction } from "../types/Story";
import { FaEllipsisVertical } from "react-icons/fa6";
import ReadController from "./ReadController";
import useTranslation from "../hooks/useTranslation";

type Props = {
  action: TAction;
  handleClick: () => void;
};

const ActionButton = ({ action, handleClick }: Props) => {
  const { data: shorttext, isLoading: shorttextLoading } = useTranslation(
    action.title
  );
  const { data: longtext, isLoading: longtextLoading } = useTranslation(
    action.desc
  );

  return (
    <Group wrap="nowrap" gap={0}>
      <Button
        size="sm"
        style={{
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
        }}
        color={!action.active ? (action.used ? "violet" : "gray") : "violet"}
        onClick={handleClick}
        disabled={!action.active && !action.used}
        tt="capitalize"
      >
        {shorttextLoading && (
          <Loader color="white" size="sm" type="dots" p={0} m={0} />
        )}
        {shorttext && shorttext}
      </Button>
      <Popover width={300} position="top" withinPortal withArrow>
        <Popover.Target>
          <Button
            size="sm"
            px="xs"
            color={
              !action.active ? (action.used ? "violet" : "gray") : "violet"
            }
            style={{
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            }}
          >
            <FaEllipsisVertical />
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap="xs">
            <Text>
              {longtextLoading && (
                <Loader color="white" size="sm" type="dots" p={0} m={0} />
              )}
              {longtext && longtext}
            </Text>
            <ReadController id="action" text={longtext} />
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
};

export default ActionButton;
