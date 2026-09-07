from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class DataSource(ABC):
    """Abstract data source interface for railway network and maintenance data."""

    @abstractmethod
    def get_stations(self) -> List[Dict[str, Any]]:
        """Retrieve list of stations."""
        pass

    @abstractmethod
    def get_sections(self) -> List[Dict[str, Any]]:
        """Retrieve list of track sections."""
        pass

    @abstractmethod
    def get_tracks(self) -> List[Dict[str, Any]]:
        """Retrieve list of physical tracks per section."""
        pass

    @abstractmethod
    def get_alternate_routes(self) -> List[Dict[str, Any]]:
        """Retrieve alternate route options between stations."""
        pass

    @abstractmethod
    def get_trains(self, status: Optional[str] = None, train_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve train master list with filter options."""
        pass

    @abstractmethod
    def get_train_by_id(self, train_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve single train details by train_id."""
        pass

    @abstractmethod
    def get_timetables(self) -> List[Dict[str, Any]]:
        """Retrieve scheduled and live train timetables."""
        pass

    @abstractmethod
    def get_maintenance_requests(self) -> List[Dict[str, Any]]:
        """Retrieve maintenance requests from all departments."""
        pass

    @abstractmethod
    def get_asset_conditions(self) -> List[Dict[str, Any]]:
        """Retrieve asset sensor/inspection condition readings."""
        pass

    @abstractmethod
    def get_resources(self) -> List[Dict[str, Any]]:
        """Retrieve available workers, crews, and machinery."""
        pass

    @abstractmethod
    def get_weather_forecast(self) -> Dict[str, Any]:
        """Retrieve weather condition forecast."""
        pass
