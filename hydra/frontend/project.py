"""Frontend project management primitives."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass(slots=True)
class ProjectVersion:
    version: str
    notes: str
    flow: Dict[str, any]


@dataclass(slots=True)
class Project:
    project_id: str
    name: str
    versions: List[ProjectVersion] = field(default_factory=list)


class ProjectStore:
    def __init__(self) -> None:
        self._projects: Dict[str, Project] = {}

    def create(self, project_id: str, name: str) -> Project:
        if project_id in self._projects:
            raise ValueError("project exists")
        project = Project(project_id, name)
        self._projects[project_id] = project
        return project

    def add_version(self, project_id: str, version: ProjectVersion) -> None:
        project = self._projects.get(project_id)
        if not project:
            raise KeyError(project_id)
        project.versions.append(version)

    def latest(self, project_id: str) -> ProjectVersion:
        project = self._projects.get(project_id)
        if not project or not project.versions:
            raise KeyError(project_id)
        return project.versions[-1]

    def list_projects(self) -> List[Project]:
        return list(self._projects.values())
