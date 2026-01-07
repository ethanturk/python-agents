import React, { useContext } from "react";
import { AuthContext } from "../contexts/AuthContext";

export function useAuth() {
  return useContext(AuthContext);
}
