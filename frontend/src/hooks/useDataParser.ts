import { useState, useCallback } from 'react';
import { autoParse, parseExcel } from '../utils/dataParser';

export interface UseDataParserState {
  rawText: string;
  parsedData: Record<string, unknown>[];
  columns: string[];
  error: string | null;
}

export function useDataParser() {
  const [state, setState] = useState<UseDataParserState>({
    rawText: '',
    parsedData: [],
    columns: [],
    error: null,
  });

  const parse = useCallback((text: string): void => {
    try {
      const data = autoParse(text);
      const columns =
        data.length > 0 ? Object.keys(data[0]) : [];

      setState({
        rawText: text,
        parsedData: data,
        columns,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        rawText: text,
        error:
          err instanceof Error ? err.message : 'Failed to parse data',
      }));
    }
  }, []);

  const parseWorkbook = useCallback((buffer: ArrayBuffer, filename = ''): void => {
    try {
      const data = parseExcel(buffer);
      const columns =
        data.length > 0 ? Object.keys(data[0]) : [];

      setState({
        rawText: filename,
        parsedData: data,
        columns,
        error: null,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        rawText: filename,
        error:
          err instanceof Error ? err.message : 'Failed to parse workbook',
      }));
    }
  }, []);

  const clear = useCallback((): void => {
    setState({
      rawText: '',
      parsedData: [],
      columns: [],
      error: null,
    });
  }, []);

  return {
    ...state,
    parse,
    parseWorkbook,
    clear,
  };
}

export default useDataParser;
