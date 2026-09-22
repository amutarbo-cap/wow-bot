import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SPECS } from '../../testing/fabrica';
import { TalentCatalogService } from './talent-catalog.service';

describe('TalentCatalogService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }),
  );

  it('descarga el catálogo una vez y busca por specId', async () => {
    const svc = TestBed.inject(TalentCatalogService);
    const http = TestBed.inject(HttpTestingController);
    const p1 = svc.spec(262);
    const p2 = svc.spec(265);
    http.expectOne('/raidbots/static/data/live/talents.json').flush([SPECS.elemental, SPECS.afliccion]);
    expect((await p1)?.specName).toBe('Elemental');
    expect((await p2)?.specName).toBe('Affliction');
    http.verify();
  });

  it('devuelve null si la descarga falla o no hay specId', async () => {
    const svc = TestBed.inject(TalentCatalogService);
    expect(await svc.spec(null)).toBeNull();
    const p = svc.spec(262);
    TestBed.inject(HttpTestingController)
      .expectOne('/raidbots/static/data/live/talents.json')
      .flush({}, { status: 500, statusText: 'Error' });
    expect(await p).toBeNull();
  });
});
