export type Option = {
    id: string;
    text: string;
};

export type Question = {
    prompt: string;
    expectedSelections: number;
    options: Option[];
    correctOptionsIds: string[];
};