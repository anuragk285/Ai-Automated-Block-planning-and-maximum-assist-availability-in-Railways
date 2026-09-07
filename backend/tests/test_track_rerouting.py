import pytest
import networkx as nx
from app.pipeline.module12_track_rerouting import resolve_train_for_blocked_track

@pytest.fixture
def mock_network_graph():
    G = nx.Graph()
    G.add_node("NDLS")
    G.add_node("GZB")
    G.add_node("ALJN")
    G.add_node("MB")
    G.add_node("BE")
    G.add_node("LKO")

    G.add_edge("NDLS", "GZB", length_km=25.0)
    G.add_edge("GZB", "ALJN", length_km=105.0) # Double track demo section
    G.add_edge("GZB", "MB", length_km=140.0)
    G.add_edge("MB", "BE", length_km=90.0)
    G.add_edge("BE", "LKO", length_km=235.0)
    G.add_edge("ALJN", "LKO", length_km=300.0)
    return G

def test_same_section_track_reassignment(mock_network_graph):
    train = {
        "train_id": "TRN-12001",
        "train_number": "12001",
        "original_path": [
            {"station_code": "NDLS", "scheduled_time": "06:00"},
            {"station_code": "GZB", "scheduled_time": "06:30"},
            {"station_code": "ALJN", "scheduled_time": "07:45"},
        ]
    }
    sections_map = {
        "SEC_GZB_ALJN": {"code": "SEC_GZB_ALJN", "start_station_code": "GZB", "end_station_code": "ALJN", "total_tracks": 2}
    }
    tracks_map = {
        "SEC_GZB_ALJN": [
            {"track_id": "TRK_1", "section_code": "SEC_GZB_ALJN", "track_number": 1, "health_status": "blocked"},
            {"track_id": "TRK_2", "section_code": "SEC_GZB_ALJN", "track_number": 2, "health_status": "healthy"},
        ]
    }

    res = resolve_train_for_blocked_track(
        train=train,
        blocked_section_code="SEC_GZB_ALJN",
        blocked_track_number=1,
        start_time_hr=2.0,
        end_time_hr=5.0,
        sections_map=sections_map,
        tracks_map=tracks_map,
        network_graph=mock_network_graph
    )

    assert res["is_rerouted"] is False
    assert res["assigned_track_number"] == 2
    assert res["assigned_path"] is None
    assert "Reassigned to Track 2" in res["resolution"]

def test_single_track_section_alternate_reroute(mock_network_graph):
    train = {
        "train_id": "TRN-12002",
        "train_number": "12002",
        "original_path": [
            {"station_code": "GZB", "scheduled_time": "06:30"},
            {"station_code": "ALJN", "scheduled_time": "07:45"},
            {"station_code": "LKO", "scheduled_time": "12:00"},
        ]
    }
    # Single-track section SEC_GZB_ALJN
    sections_map = {
        "SEC_GZB_ALJN": {"code": "SEC_GZB_ALJN", "start_station_code": "GZB", "end_station_code": "ALJN", "total_tracks": 1}
    }
    tracks_map = {
        "SEC_GZB_ALJN": [
            {"track_id": "TRK_1", "section_code": "SEC_GZB_ALJN", "track_number": 1, "health_status": "blocked"},
        ]
    }

    res = resolve_train_for_blocked_track(
        train=train,
        blocked_section_code="SEC_GZB_ALJN",
        blocked_track_number=1,
        start_time_hr=2.0,
        end_time_hr=5.0,
        sections_map=sections_map,
        tracks_map=tracks_map,
        network_graph=mock_network_graph
    )

    assert res["is_rerouted"] is True
    assert res["has_viable_route"] is True
    assert res["assigned_path"] is not None
    assert "Rerouted via alternate path" in res["resolution"]
