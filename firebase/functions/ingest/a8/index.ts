// firebase/functions/ingest/a8/index.ts
// NodeNext では JSON を import する際に import attributes が必要（TS5: assert→with）

import karirakuGeo       from "./kariraku-geo-arekore.json" with { type: "json" };
import karirakuHappyrent from "./kariraku-happyrent.json"   with { type: "json" };
import karirakuKasite    from "./kariraku-kasite.json"      with { type: "json" };

export const uiProfiles: Record<string, any> = {
  "kariraku:geo-arekore": karirakuGeo,
  "kariraku:happyrent":   karirakuHappyrent,
  "kariraku:kasite":      karirakuKasite,
};
