import pandas as pd
import tempfile
import os
import logging
from io import BytesIO
from typing import Union, Optional

logger = logging.getLogger(__name__)

class FileConversionUtils:
    @staticmethod
    def convert_xls_to_xlsx(source: Union[str, BytesIO], filename: str) -> Optional[str]:
        """
        Converts an .xls file (path or stream) to a temporary .xlsx file.
        Returns the path to the temporary .xlsx file.
        The caller is responsible for cleaning up the temp file.
        """
        try:
            if isinstance(source, BytesIO):
                df_dict = pd.read_excel(source, sheet_name=None)
            else:
                df_dict = pd.read_excel(source, sheet_name=None)
            
            temp_xlsx = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
            temp_xlsx_path = temp_xlsx.name
            temp_xlsx.close()
            
            with pd.ExcelWriter(temp_xlsx_path, engine='openpyxl') as writer:
                 for sheet_name, df in df_dict.items():
                     df.to_excel(writer, sheet_name=sheet_name, index=False)
            
            return temp_xlsx_path
        except Exception as e:
            logger.error(f"Failed to convert .xls {filename}: {str(e)}")
            return None

    @staticmethod
    def cleanup_temp_file(filepath: Optional[str]):
        """Safely removes a temporary file if it exists."""
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception as e:
                logger.warning(f"Failed to cleanup temp file {filepath}: {e}")
