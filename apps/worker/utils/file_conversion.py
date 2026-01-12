import logging
import os
import tempfile
from io import BytesIO
from pathlib import Path
from typing import Optional, Union

import pandas as pd

logger = logging.getLogger(__name__)


class FileConversionUtils:
    @staticmethod
    def convert_xls_to_xlsx(source: Union[str, BytesIO, Path], filename: str) -> Optional[str]:
        """
        Converts an .xls file (path or stream) to a temporary .xlsx file.
        Returns the path to the temporary .xlsx file.
        The caller is responsible for cleaning up the temp file.
        """
        try:
            if isinstance(source, Path):
                source = str(source)

            if isinstance(source, BytesIO):
                df_dict = pd.read_excel(source, sheet_name=None)
            else:
                df_dict = pd.read_excel(source, sheet_name=None)

            temp_xlsx = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
            temp_xlsx_path = temp_xlsx.name
            temp_xlsx.close()

            with pd.ExcelWriter(temp_xlsx_path, engine="openpyxl") as writer:
                for sheet_name, df in df_dict.items():
                    df.to_excel(writer, sheet_name=sheet_name, index=False)

            return temp_xlsx_path
        except Exception as e:
            logger.error(f"Failed to convert .xls {filename}: {str(e)}")
            return None

    @staticmethod
    def is_xls_file(source: Union[str, Path, BytesIO], filename: str = None) -> bool:
        """Check if source is an XLS file."""
        if filename:
            return filename.lower().endswith(".xls")
        if isinstance(source, (str, Path)):
            return str(source).lower().endswith(".xls")
        return False

    @staticmethod
    def prepare_source_for_conversion(
        source: Union[str, Path, BytesIO], filename: str = None
    ) -> tuple:
        """
        Prepare file source for document conversion.
        Handles XLS conversion and returns (prepared_source, temp_file_to_cleanup).

        Returns:
            tuple: (source_ready_for_conversion, temp_file_path_or_None)
        """
        temp_file = None
        prepared_source = source

        if FileConversionUtils.is_xls_file(source, filename):
            temp_file = FileConversionUtils.convert_xls_to_xlsx(source, filename)
            if temp_file:
                prepared_source = temp_file

        return prepared_source, temp_file

    @staticmethod
    def cleanup_temp_file(filepath: Optional[str]):
        """Safely removes a temporary file if it exists."""
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception as e:
                logger.warning(f"Failed to cleanup temp file {filepath}: {e}")
