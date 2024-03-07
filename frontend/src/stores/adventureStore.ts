import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { createSelectors } from "../utils/createSelectors";
import { TImage } from "../types/Image";
import { TCharacter } from "../types/Character";
import { TPremise } from "../types/Premise";
import { TAction, TStory, TStoryPart } from "../types/Story";

const initialState = {
  id: null as string | null,
  image: null as TImage | null,
  character: null as TCharacter | null,
  premise: null as TPremise | null,
  story: null as TStory | null,
  finished: false,
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
  useAdventureStore.setState(() => {
    return {
      story,
    };
  });
};

export const appendStory = (part: TStoryPart) => {
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

export const chooseAction = (action: TAction) => {
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
