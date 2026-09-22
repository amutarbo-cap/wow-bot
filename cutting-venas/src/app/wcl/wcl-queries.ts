export const QUERY_RESUMEN = `
query Resumen($code: String!) {
  reportData {
    report(code: $code) {
      title
      fights(killType: Encounters) { id name encounterID difficulty kill startTime endTime friendlyPlayers }
      masterData { actors(type: "Player") { id name subType } }
    }
  }
}`;

export const QUERY_JUGADORES = `
query Jugadores($code: String!, $fight: Int!) {
  reportData {
    report(code: $code) {
      playerDetails(fightIDs: [$fight])
    }
  }
}`;

export const QUERY_DETALLE = `
query Detalle($code: String!, $fights: [Int]!, $source: Int!, $filtro: String!) {
  reportData {
    report(code: $code) {
      masterData { abilities { gameID name icon } }
      danoHecho: table(fightIDs: $fights, sourceID: $source, dataType: DamageDone)
      casteos: table(fightIDs: $fights, sourceID: $source, dataType: Casts)
      buffs: table(fightIDs: $fights, sourceID: $source, dataType: Buffs, filterExpression: $filtro)
      debuffs: table(fightIDs: $fights, dataType: Debuffs, hostilityType: Enemies, filterExpression: $filtro)
      danoRecibido: table(fightIDs: $fights, sourceID: $source, dataType: DamageTaken)
      muertes: table(fightIDs: $fights, sourceID: $source, dataType: Deaths)
      combatantInfo: events(fightIDs: $fights, sourceID: $source, dataType: CombatantInfo, limit: 5) { data }
    }
  }
}`;

export const QUERY_EVENTOS = `
query Eventos($code: String!, $fight: Int!, $source: Int!, $inicio: Float!, $fin: Float!) {
  reportData {
    report(code: $code) {
      events(fightIDs: [$fight], sourceID: $source, dataType: Casts, startTime: $inicio, endTime: $fin, limit: 10000) {
        data
        nextPageTimestamp
      }
    }
  }
}`;

export function filtroPorNombre(nombre: string): string {
  return `source.name = "${nombre.replace(/"/g, '')}"`;
}
