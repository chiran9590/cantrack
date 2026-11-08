from datetime import date
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

Role = Literal["admin", "manager", "breeder", "gardener", "member"]
EMAIL = r"^[^@\s]+@[^@\s]+$"


class Login(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class Register(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(pattern=EMAIL, max_length=120)
    password: str = Field(min_length=8, max_length=72)


class ChangePassword(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class NewUser(BaseModel):
    name: str = Field(min_length=1)
    email: str = Field(pattern=EMAIL)
    password: str = Field(min_length=8)
    role: Role


class UserPatch(BaseModel):
    name: str | None = Field(None, min_length=1)
    role: Role | None = None
    active: bool | None = None
    password: str | None = Field(None, min_length=8)


class NewHouse(BaseModel):
    code: str = Field(pattern=r"^[A-Z0-9]{1,4}$")
    name: str = Field(min_length=1, max_length=60)
    description: str = Field("", max_length=300)
    platforms: int = Field(ge=1, le=50)
    columns: int = Field(ge=1, le=50)
    rows: int = Field(ge=1, le=500)


class NewGenotype(BaseModel):
    gid: str = Field(pattern=r"^[A-Za-z0-9._-]{1,40}$")
    phenomeone_id: str | None = None
    info: dict = {}


class NewPlants(BaseModel):
    gid: str = Field(min_length=1)
    sown_date: date | None = None
    count: int = Field(1, ge=1, le=200)


class Scan(BaseModel):
    position_id: str = Field(min_length=1)
    plant_uuid: UUID
    session_id: str | None = Field(None, max_length=40)
    source: Literal["web", "mobile"] = "web"
    device: str | None = Field(None, max_length=60)


class RemovePlant(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


class Correction(BaseModel):
    position_id: str = Field(min_length=1)
    reason: str = Field(min_length=3, max_length=300)
