import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { createSelectors } from "../utils/createSelectors";
import { TImage } from "../types/Image";
import { TCharacter } from "../types/Character";
import { TPremise } from "../types/Premise";
import { TAction, TStory, TStoryPart } from "../types/Story";
import { TableData } from "@mantine/core";

const initialState = {
  id: null as string | null,
  image: null as TImage | null,
  character: null as TCharacter | null,
  premise: null as TPremise | null,
  story: null as TStory | null,
  finished: false,
};

const keypointsTableData: TableData = {
  // caption: 'Keypoints of the story',
  head: ['Story Part', 'Who', 'Where', 'Objects'],
  body: [
    // [1, 'Riccardo', 'Roma', 'A red car'],
  ],
};

export const useAdventureStore = createSelectors(
  create<typeof initialState>()(
    devtools(
      persist(() => initialState, {
        name: "adventure",
        storage: createJSONStorage(() => sessionStorage),
      }),
      {
        name: "Adventure",
      }
    )
  )
);

export const clearStore = () => {
  useAdventureStore.setState(initialState);
  useKeyPointsState.setState(keypointsTableData);
};

export const setCharacter = (
  id: string,
  image: TImage,
  character: TCharacter
) => {
  useAdventureStore.setState(() => {
    return {
      id,
      image,
      character,
    };
  });
};

export const setPremise = (premise: TPremise) => {
  useAdventureStore.setState(() => {
    return {
      premise,
    };
  });
};

export const startStory = (story: TStory) => {
  if (story.parts.length > 0) { 
    addKeyPoints([story.parts[0].who, story.parts[0].where, story.parts[0].objects]);
  }
  useAdventureStore.setState(() => {
    return {
      story,
    };
  });
};

export const appendStory = (part: TStoryPart) => {
  console.log("Appending story part: ", part);
  addKeyPoints([part.who, part.where, part.objects]);
  useAdventureStore.setState((state) => {
    if (!state.story) return state;
    return {
      story: {
        ...state.story,
        parts: [...state.story.parts, part],
      },
    };
  });
};

export const updateActions = (actions: TAction[]) => {
  useAdventureStore.setState((state) => {
    if (!state.story) return state;
    const parts = state.story.parts;
    parts[parts.length - 1].actions = actions;
    return {
      story: {
        ...state.story,
        parts,
      },
    };
  });
};

export const chooseAction = (action: TAction | null) => {
  if (action === null) {
    action = {id: "", title: "Motion Capture", desc: "", active: true, used: false};
    useAdventureStore.setState((state) => {
      if (!state.story) return state;
      const parts = state.story.parts;
      parts[parts.length - 2].actions = parts[parts.length - 2].actions?.map(
        (a) => {
          a.active = false;
          if (a.title === action?.title) {
            a.used = true;
          }
          return a;
        }
      );
      return {
        story: {
          ...state.story,
          parts,
        },
      };
    });
  }
  useAdventureStore.setState((state) => {
    if (!state.story) return state;
    const parts = state.story.parts;
    parts[parts.length - 1].actions = parts[parts.length - 1].actions?.map(
      (a) => {
        a.active = false;
        if (a.title === action.title) {
          a.used = true;
        }
        return a;
      }
    );
    return {
      story: {
        ...state.story,
        parts,
      },
    };
  });
};

export const printState = () => {
  console.log("Story state: ", useAdventureStore.getState());
}

export const getStoryText = () => {
  return useAdventureStore.getState().story?.parts.map((part) => part.text);
};

export const canChooseAction = () => {
  return useAdventureStore
    .getState()
    .story?.parts[
      useAdventureStore.getState().story!.parts.length - 1
    ].actions?.every((a) => !a.used);
};

export const updateStoryImage = (image_url: string) => {
  useAdventureStore.setState((state) => {
    if (!state.story) return state;
    const parts = state.story.parts;
    parts[parts.length - 1].image = image_url;
    return {
      story: {
        ...state.story,
        parts,
      },
    };
  });
};

export const setFinished = () => {
  useAdventureStore.setState((state) => {
    return {
      ...state,
      finished: true,
    };
  });
};

export const useKeyPointsState = createSelectors(
  create<typeof keypointsTableData>()(
    devtools(
      persist(() => keypointsTableData, {
        name: "keypoints",
        storage: createJSONStorage(() => sessionStorage),
      }),
      {
        name: "KeyPoints",
      }
    )
  )
);

export const getKeyPointsTable = () => {
  const kp = useKeyPointsState.getState()
  return {
    head: kp.head,
    body: kp.body?.map((row) => [
      row[0],
      Array.isArray(row[1]) ? row[1].join(", ") : row[1],
      row[2],
      Array.isArray(row[3]) ? row[3].join(", ") : row[3],
    ]),
  };
}

export const checkFormat = (kp: any) => {
  return {
    head: kp.head,
    body: kp.body?.map((row) => [
      row[0],
      Array.isArray(row[1]) ? row[1].join(", ") : row[1],
      row[2],
      Array.isArray(row[3]) ? row[3].join(", ") : row[3],
    ]),
  };
}

export const addKeyPoints = (keypoints: any) => {
  console.log("Adding keypoint: ", keypoints);
  useKeyPointsState.setState((state) => {
    return {
      ...state,
      body: [...(state.body || []), [(state.body?.length ?? 0) + 1, ...keypoints]],
    };
  });
}