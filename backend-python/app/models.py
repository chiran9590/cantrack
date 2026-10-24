from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=True)
    name = Column(String(100), nullable=True)
    password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    assets_assigned = relationship("Asset", back_populates="assigned_user")
    scans = relationship("Scan", back_populates="scanned_by_user")


class Plant(Base):
    __tablename__ = "plants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(100))
    capacity = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    assets = relationship("Asset", back_populates="plant")


class Position(Base):
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)
    level = Column(String(10), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    assets = relationship("Asset", back_populates="position")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    tag_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    type = Column(String(50))
    status = Column(String(20), default="available")
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    plant_id = Column(Integer, ForeignKey("plants.id"), nullable=True)
    position_id = Column(Integer, ForeignKey("positions.id"), nullable=True)
    last_scan = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    assigned_user = relationship("User", back_populates="assets_assigned")
    plant = relationship("Plant", back_populates="assets")
    position = relationship("Position", back_populates="assets")
    scans = relationship("Scan", back_populates="asset")


class Scan(Base):
    __tablename__ = "scans"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    scanned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    location = Column(String(100))
    scan_time = Column(DateTime(timezone=True), server_default=func.now())

    asset = relationship("Asset", back_populates="scans")
    scanned_by_user = relationship("User", back_populates="scans")
