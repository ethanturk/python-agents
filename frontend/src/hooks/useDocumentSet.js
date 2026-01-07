import React, { useContext } from "react";
import { DocumentSetContext } from "../contexts/DocumentSetContext";

export function useDocumentSet() {
  return useContext(DocumentSetContext);
}
