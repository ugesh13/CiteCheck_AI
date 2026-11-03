declare module 'mammoth/mammoth.browser' {
  const mammoth: {
    extractRawText(options: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: any[] }>;
    convertToHtml(options: { arrayBuffer: ArrayBuffer }): Promise<{ value: string; messages: any[] }>;
    [key: string]: any;
  };
  export default mammoth;
}
