from dataclasses import dataclass


@dataclass
class EmailContent:
    subject: str
    html: str
    text: str
