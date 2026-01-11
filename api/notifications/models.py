from pydantic import BaseModel


class NotificationRequest(BaseModel):
    type: str
    filename: str
    status: str
    result: str
