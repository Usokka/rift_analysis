from pathlib import Path

from scripts.build_portfolio_demo import build_catalog, case_study

ROOT = Path(__file__).resolve().parents[3]
SAMPLE = ROOT / "data/fixtures/oracle_elixir_sample.csv"


def test_static_catalog_contains_comparable_team_snapshots():
    metadata, overviews = build_catalog(
        [SAMPLE],
        selections=(("LFL2", 2023),),
        teams_per_league=3,
        min_team_matches=1,
        preferred_team_names=("Joblife", "Atletec", "Klanik Esport"),
    )

    assert metadata["data_status"]["matches"] == 4
    assert metadata["data_status"]["raw_rows"] == 48
    assert metadata["leagues"] == [{"league": "LFL2", "year": 2023, "matches": 4}]
    assert len(metadata["teams"]) == len(overviews) == 3
    assert {team["snapshot"] for team in metadata["teams"]} == set(overviews)
    assert all(path.startswith("overviews/2023/lfl2/") for path in overviews)

    default = metadata["default_selection"]
    primary = next(
        overview
        for overview in overviews.values()
        if overview["filters"]["team_id"] == default["team_id"]
    )
    assert primary["filters"]["team_name"] == "Joblife"
    assert default["comparison_team_id"] != default["team_id"]
    assert len(primary["team_metrics"]) == 15
    assert "se limite explicitement à LFL2" in case_study(primary, metadata, [SAMPLE])
