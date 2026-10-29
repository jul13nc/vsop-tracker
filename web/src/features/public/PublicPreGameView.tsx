import { Link } from "react-router-dom";
import ChipStack from "../../components/ChipStack";
import SeatingTables from "../../components/SeatingTables";
import { startingStackValue } from "../../domain/chips";
import { formatGamedayDate } from "../../domain/dates";
import { seatingFromRows } from "../../domain/seating";
import type {
  Gameday,
  GamedayPlayer,
  Player,
  Season,
} from "../../types/domain";

interface Props {
  gameday: Gameday;
  season: Season;
  players: Player[];
  gamedayPlayers: GamedayPlayer[];
}

/**
 * Public pre-game screen: shows the starting stacks and the table placement
 * while the gameday is still in "setup". The public page switches to the
 * tournament clock once the admin starts the gameday (status "live").
 */
export default function PublicPreGameView({
  gameday,
  season,
  players,
  gamedayPlayers,
}: Props) {
  const nameById = new Map(players.map((p) => [p.id, p.display_name]));
  const { seating, unplaced: unplacedIds } = seatingFromRows(gamedayPlayers);
  const unplaced = unplacedIds.map((id) => nameById.get(id) ?? id);

  return (
    <div className="app app--public-pregame">
      <h2>Journée du {formatGamedayDate(gameday.date)}</h2>

      <div className="public-pregame-grid">
        <div className="card">
          <h3>Stack de départ</h3>
          <ChipStack chips={season.chip_config} />
          <p className="muted">
            Chaque joueur reçoit {startingStackValue(season.chip_config)} jetons.
          </p>
        </div>

        {seating.length > 0 && (
          <div className="card">
            <h3>Placement des tables</h3>
            <SeatingTables seating={seating} nameById={nameById} />
          </div>
        )}
      </div>

      {unplaced.length > 0 && (
        <p className="muted">Non placés : {unplaced.join(", ")}</p>
      )}

      <Link
        className="btn btn--ghost btn--block"
        to={`/pub/${season.id}`}
        style={{ marginTop: 12 }}
      >
        ← Classement
      </Link>
    </div>
  );
}
