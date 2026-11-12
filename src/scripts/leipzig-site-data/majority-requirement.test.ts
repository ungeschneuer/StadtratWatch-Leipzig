import { describe, expect, it } from 'bun:test';

import { majorityRequirementOf } from './majority-requirement.ts';

const motion = (title: string, paperReference = 'VIII-DS-01234') => ({ title, paperReference, procedural: false });

describe('majorityRequirementOf', () => {
  it('asks the majority of all members for the Hauptsatzung', () => {
    expect(
      majorityRequirementOf(
        motion(
          '5. Satzung zur Änderung der Hauptsatzung der Stadt Leipzig aufgrund des Grundsatzbeschlusses',
          'VIII-DS-02011-NF-01-DS-01',
        ),
      ),
    ).toBe('majority-of-members');
    expect(majorityRequirementOf(motion('Neufassung der Hauptsatzung der Stadt Leipzig'))).toBe('majority-of-members');
  });

  it('leaves amendments to the Hauptsatzung at the simple majority', () => {
    expect(
      majorityRequirementOf(motion('Satzung zur Änderung der Hauptsatzung', 'VIII-DS-02011-ÄA-01')),
    ).toBeUndefined();
  });

  it('leaves a paper that changes the Hauptsatzung in one of several points at the simple majority', () => {
    expect(
      majorityRequirementOf(
        motion(
          'Grundsatzbeschluss zur Anwendung des „Bauturbo“ und Satzungsbeschluss zur verbundenen Änderung der Hauptsatzung',
          'VIII-DS-02011-NF-01',
        ),
      ),
    ).toBeUndefined();
  });

  it('does not take a decision that only cites the Hauptsatzung for one changing it', () => {
    expect(
      majorityRequirementOf(
        motion('Personalangelegenheit nach § 6 Abs. 1 i. V. m. § 21 Abs. 2 Nr. 20 Hauptsatzung – Beförderung'),
      ),
    ).toBeUndefined();
  });

  it('asks two thirds of all members for honorary citizenship and the honorary medal', () => {
    expect(majorityRequirementOf(motion('Verleihung der Ehrenbürgerwürde an Frau Muster'))).toBe(
      'two-thirds-of-members',
    );
    expect(majorityRequirementOf(motion('Verleihung der Ehrenmedaille der Stadt Leipzig'))).toBe(
      'two-thirds-of-members',
    );
    expect(majorityRequirementOf(motion('Aberkennung des Ehrenbürgerrechts'))).toBe('two-thirds-of-members');
  });

  it('leaves a petition for an honorary citizenship at the simple majority', () => {
    expect(
      majorityRequirementOf(motion('Verleihung der Ehrenbürgerwürde an Herrn Muster', 'VIII-P-00321')),
    ).toBeUndefined();
  });

  it('asks two thirds of all members for a referendum the council calls', () => {
    expect(majorityRequirementOf(motion('Durchführung eines Bürgerentscheids zum Stadtbad'))).toBe(
      'two-thirds-of-members',
    );
    expect(majorityRequirementOf(motion('Ratsbürgerentscheid zur Straßenbahnlinie'))).toBe('two-thirds-of-members');
  });

  it('leaves motions about referendums in general at the simple majority', () => {
    expect(
      majorityRequirementOf(
        motion('Bürgerbegehren und Bürgerentscheide in den Leipziger Ortschaften ermöglichen!', 'VIII-A-00958'),
      ),
    ).toBeUndefined();
  });

  it('asks the majority of those present for an election', () => {
    expect(majorityRequirementOf(motion('Wahl der Beigeordneten für Kultur'))).toBe('majority-of-present');
    expect(majorityRequirementOf(motion('Die Ratsversammlung wählt den Ersten Bürgermeister'))).toBe(
      'majority-of-present',
    );
  });

  it('leaves appointments, delegations and words that only contain "Wahl" at the simple majority', () => {
    for (const title of [
      'Stadtbezirksbeirat Südwest - Bestellung der Mitglieder (5. Änderung)',
      'Bestellung der Geschäftsführung der Leipziger Quartiersentwicklungsgesellschaft mbH (LQEG)',
      'Stiftung Völkerschlachtdenkmal - Abberufung und Entsendung von Stadträten',
      '1. Satzung zur Änderung der Wahlwerbesatzung',
      'Gemeindewahlausschuss für die Oberbürgermeisterwahl 2027',
      'Eigenheime für Leipzig - Veräußerung städtischer Grundstücke mit Wahlmöglichkeit',
    ]) {
      expect(majorityRequirementOf(motion(title))).toBeUndefined();
    }
  });

  it('leaves procedural motions at the simple majority', () => {
    expect(
      majorityRequirementOf({ title: 'Satzung zur Änderung der Hauptsatzung', paperReference: null, procedural: true }),
    ).toBeUndefined();
  });
});
