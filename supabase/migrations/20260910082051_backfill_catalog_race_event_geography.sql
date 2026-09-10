-- Extend normalized geography to the rest of the live catalog without
-- guessing ambiguous international anchor cities. French commune data comes
-- from geo.api.gouv.fr (checked by INSEE code on 2026-09-10). International
-- country values reuse the official UTMB catalog provenance already stored on
-- each event; city/admin coordinates remain null until a locality is verified.

with french_geography (
  event_id, city, city_code, department, department_code,
  region, region_code, latitude, longitude
) as (
  values
    ('2c088707-9c68-4a13-be9f-a8c328959a3e'::uuid, 'Lyon', '69123', 'Rhône', '69', 'Auvergne-Rhône-Alpes', '84', 45.7580, 4.8351),
    ('bec79481-b3d7-4a97-bde8-18a3abb54c08'::uuid, 'Locunolé', '29136', 'Finistère', '29', 'Bretagne', '53', 47.9239, -3.4859),
    ('664f160a-76d7-434c-a805-5ba8690b3304'::uuid, 'Besançon', '25056', 'Doubs', '25', 'Bourgogne-Franche-Comté', '27', 47.2602, 6.0123),
    ('d2a49aca-0db5-4568-86df-77f7019059da'::uuid, 'Millau', '12145', 'Aveyron', '12', 'Occitanie', '76', 44.0982, 3.1176),
    ('c1c84901-ac29-4956-bc25-5788f0a5c7e5'::uuid, 'Hyères', '83069', 'Var', '83', 'Provence-Alpes-Côte d''Azur', '93', 43.1139, 6.2357),
    ('ea5f1bec-ebb9-418a-9898-09250a35f108'::uuid, 'La Clayette', '71133', 'Saône-et-Loire', '71', 'Bourgogne-Franche-Comté', '27', 46.2883, 4.3122),
    ('b6bd690c-14ac-4718-8512-030320f5868d'::uuid, 'Saint-Guilhem-le-Désert', '34261', 'Hérault', '34', 'Occitanie', '76', 43.7536, 3.5439),
    ('53577181-6afd-4391-9ce9-cece40f39ad5'::uuid, 'La Tour-d''Aigues', '84133', 'Vaucluse', '84', 'Provence-Alpes-Côte d''Azur', '93', 43.7128, 5.5682),
    ('5e328b3c-2301-4178-a0b0-30cfcb71505c'::uuid, 'Eaunes', '31165', 'Haute-Garonne', '31', 'Occitanie', '76', 43.4324, 1.3543),
    ('60bdb000-b9ee-4dd8-8cbb-06b189db8f99'::uuid, 'Salazie', '97421', 'La Réunion', '974', 'La Réunion', '04', -21.0524, 55.5145),
    ('08a81d9c-7682-4e6a-947d-9b17573dca92'::uuid, 'Chamonix-Mont-Blanc', '74056', 'Haute-Savoie', '74', 'Auvergne-Rhône-Alpes', '84', 45.9296, 6.9291),
    ('36d31dc1-4d2e-45c6-a176-caa6203e84ae'::uuid, 'Saint-Louis', '97414', 'La Réunion', '974', 'La Réunion', '04', -21.2254, 55.4224),
    ('67246343-be85-427e-961b-a72a02a0e59a'::uuid, 'Moncontour', '22153', 'Côtes-d''Armor', '22', 'Bretagne', '53', 48.3585, -2.6348),
    ('b7026aa5-7f15-46ea-9d60-1af0c7ae14b1'::uuid, 'Réquista', '12197', 'Aveyron', '12', 'Occitanie', '76', 44.0292, 2.5526),
    ('3593fa6a-ee15-4236-85c0-a4cc1cecc9c7'::uuid, 'Saint-Étienne-les-Orgues', '04178', 'Alpes-de-Haute-Provence', '04', 'Provence-Alpes-Côte d''Azur', '93', 44.0648, 5.7798),
    ('03bffad4-6d8f-4015-9e60-4f29753de239'::uuid, 'Saint-Léger-sous-Beuvray', '71440', 'Saône-et-Loire', '71', 'Bourgogne-Franche-Comté', '27', 46.9190, 4.0928),
    ('21aef1f3-567a-47a5-b7f9-fd72a7f540e0'::uuid, 'Toussieux', '01423', 'Ain', '01', 'Auvergne-Rhône-Alpes', '84', 45.9610, 4.8289),
    ('4611d361-52e1-46e9-9860-4b197448e416'::uuid, 'Oyonnax', '01283', 'Ain', '01', 'Auvergne-Rhône-Alpes', '84', 46.2599, 5.6517),
    ('e0105312-c180-4924-87bd-7de6824dd87f'::uuid, 'Chaumousey', '88098', 'Vosges', '88', 'Grand Est', '44', 48.1720, 6.3251),
    ('f7b6ebd5-0121-4a04-84cf-ff7a0c2a84c6'::uuid, 'La Motte-Servolex', '73179', 'Savoie', '73', 'Auvergne-Rhône-Alpes', '84', 45.6037, 5.8540),
    ('bddc615a-1474-495c-9d77-315c58c02750'::uuid, 'Plouguiel', '22221', 'Côtes-d''Armor', '22', 'Bretagne', '53', 48.8065, -3.2455),
    ('aab7ab38-eae1-4e2e-b6dd-6c57e6a04da0'::uuid, 'Chasselay', '69049', 'Rhône', '69', 'Auvergne-Rhône-Alpes', '84', 45.8733, 4.7699),
    ('67ec35b6-be28-4742-9230-b994db613c20'::uuid, 'Port-sur-Saône', '70421', 'Haute-Saône', '70', 'Bourgogne-Franche-Comté', '27', 47.6893, 6.0340),
    ('fc02a808-53cb-46fc-8be0-ab8fa1d5e943'::uuid, 'Mercury', '73154', 'Savoie', '73', 'Auvergne-Rhône-Alpes', '84', 45.6929, 6.3434),
    ('0eec876e-bb5c-4bef-85f1-073904fad739'::uuid, 'Montferrat', '38256', 'Isère', '38', 'Auvergne-Rhône-Alpes', '84', 45.4785, 5.5800),
    ('b669716c-c1a9-4d3b-bd1d-41203fa7ff98'::uuid, 'Guéret', '23096', 'Creuse', '23', 'Nouvelle-Aquitaine', '75', 46.1585, 1.8705),
    ('e4ce7df9-e819-461e-9142-6bb8f02e3642'::uuid, 'Levens', '06075', 'Alpes-Maritimes', '06', 'Provence-Alpes-Côte d''Azur', '93', 43.8501, 7.2358),
    ('b58585f6-109e-4381-89f8-69bfe9391c4a'::uuid, 'Plourhan', '22232', 'Côtes-d''Armor', '22', 'Bretagne', '53', 48.6303, -2.8839),
    ('1a8752ae-d4fe-4582-9f45-dca312270115'::uuid, 'Les Mathes', '17225', 'Charente-Maritime', '17', 'Nouvelle-Aquitaine', '75', 45.7056, -1.1776),
    ('7a110000-0000-4000-8000-000000000001'::uuid, 'Samoëns', '74258', 'Haute-Savoie', '74', 'Auvergne-Rhône-Alpes', '84', 46.0762, 6.7553),
    ('4372ed2d-947c-41a6-89e7-35de2660b013'::uuid, 'Pons', '17283', 'Charente-Maritime', '17', 'Nouvelle-Aquitaine', '75', 45.5763, -0.5594),
    ('e42a6bfc-a619-4db8-b6f9-0ff4018a21c8'::uuid, 'Le Montat', '46197', 'Lot', '46', 'Occitanie', '76', 44.3881, 1.4567),
    ('3449e400-cb7c-4462-9743-2c14ac683a89'::uuid, 'Laveissière', '15101', 'Cantal', '15', 'Auvergne-Rhône-Alpes', '84', 45.0985, 2.7837),
    ('6625758f-f587-4de7-b243-d60b05aff092'::uuid, 'Argentat-sur-Dordogne', '19010', 'Corrèze', '19', 'Nouvelle-Aquitaine', '75', 45.1166, 1.9319),
    ('871a3177-8e8c-4f3f-96ef-00fc67a5c160'::uuid, 'Malaucène', '84069', 'Vaucluse', '84', 'Provence-Alpes-Côte d''Azur', '93', 44.1804, 5.1559),
    ('f3001eea-e766-4eeb-9dd3-a88944c5e06e'::uuid, 'Le Puy-en-Velay', '43157', 'Haute-Loire', '43', 'Auvergne-Rhône-Alpes', '84', 45.0283, 3.8973)
)
update public.race_events as event
set location_city = source.city,
    location_city_code = source.city_code,
    location_department = source.department,
    location_department_code = source.department_code,
    location_region = source.region,
    location_region_code = source.region_code,
    location_country = 'France',
    location_country_code = 'FR',
    location_latitude = source.latitude,
    location_longitude = source.longitude,
    organizer_details = case
      when nullif(event.organizer_details -> 'eventLocation' ->> 'lat', '') is not null
       and nullif(event.organizer_details -> 'eventLocation' ->> 'lng', '') is not null
        then coalesce(event.organizer_details, '{}'::jsonb)
      else jsonb_set(
        coalesce(event.organizer_details, '{}'::jsonb),
        '{eventLocation}',
        jsonb_build_object(
          'label', event.location,
          'lat', source.latitude,
          'lng', source.longitude,
          'googleMapsUrl', format(
            'https://www.google.com/maps/search/?api=1&query=%s%%2C%s',
            source.latitude,
            source.longitude
          ),
          'source', 'manual'
        ),
        true
      )
    end
from french_geography as source
where event.id = source.event_id
  and event.location_city_code is null;

with international_countries (event_id, country, country_code) as (
  values
    ('4f4ab461-bbe0-4e03-851b-73a46751c16d'::uuid, 'Royaume-Uni', 'GB'),
    ('0c556cc2-7556-4508-8d91-5fcfd58ba36e'::uuid, 'Italie', 'IT'),
    ('4976d3d5-ecb9-4592-9b42-43d75abc2c24'::uuid, 'Mexique', 'MX'),
    ('d7482bbd-1442-470f-8b1f-6ac71283ebf8'::uuid, 'États-Unis', 'US'),
    ('cf7ddee3-ca48-4fd3-95a3-d57204984224'::uuid, 'Suisse', 'CH'),
    ('6ff39f72-4e5a-400e-9fe1-108624255336'::uuid, 'Lettonie', 'LV'),
    ('310fc52b-601f-4586-9d46-1425f1f6b865'::uuid, 'États-Unis', 'US'),
    ('d27bc902-3525-4346-9cec-5da411aef7c4'::uuid, 'Japon', 'JP'),
    ('032e62ea-8ed6-418d-a6f8-98c2fa082f60'::uuid, 'Thaïlande', 'TH'),
    ('fa0b393e-6f74-4e9a-b814-839ae06f4fd6'::uuid, 'États-Unis', 'US'),
    ('39fd2b83-f4a0-4654-8538-f825045230b7'::uuid, 'États-Unis', 'US'),
    ('7f1cbe60-55dd-442d-a071-8ff8906c1069'::uuid, 'Australie', 'AU'),
    ('17534bf1-4237-4d7d-8872-b66a15cb6651'::uuid, 'Espagne', 'ES'),
    ('20999cd4-4828-4422-be03-b154ca494c45'::uuid, 'Croatie', 'HR'),
    ('a5f16021-338c-49eb-9066-f6e5d57b6b80'::uuid, 'Chine', 'CN'),
    ('a75bdb06-d911-45ce-9459-f490519453d5'::uuid, 'Argentine', 'AR'),
    ('84c38478-b7b3-4307-9f89-8c3b103ecf05'::uuid, 'Slovénie', 'SI'),
    ('684cffed-7f66-4314-9ea6-63f754a8ec11'::uuid, 'Turquie', 'TR'),
    ('940a32ef-0549-4a88-aa07-c7cc318e5d69'::uuid, 'Autriche', 'AT'),
    ('290710aa-d9b9-4f87-b2d8-f8577b6f3c52'::uuid, 'Suède', 'SE'),
    ('3852af31-ea74-416b-a45e-18e41d1b7748'::uuid, 'Italie', 'IT'),
    ('1170e234-0898-4c6a-be2f-e4ec7bf4ea7b'::uuid, 'Malaisie', 'MY'),
    ('87f9219c-0f88-453b-a788-188a63977974'::uuid, 'Espagne', 'ES'),
    ('2fa78236-6189-43bc-8b8e-2782a527afff'::uuid, 'Italie', 'IT'),
    ('1b5a5656-7004-47e4-afb4-9ff59902b624'::uuid, 'Afrique du Sud', 'ZA'),
    ('92285595-36f6-4ebf-aa8d-1cd205e61275'::uuid, 'Autriche', 'AT'),
    ('674089bd-3feb-43e6-8902-baeb591afac2'::uuid, 'Portugal', 'PT'),
    ('0a821055-7e30-4bbd-9ca7-dbf75348456b'::uuid, 'Oman', 'OM'),
    ('5bfc264c-5373-456d-bfba-9e82be09054f'::uuid, 'Brésil', 'BR'),
    ('f0f0411d-ea06-4373-9115-d47becc6fa0e'::uuid, 'Argentine', 'AR'),
    ('f43abb91-45ea-4ee5-8456-cd61e7325162'::uuid, 'Mexique', 'MX'),
    ('c66c7973-13c7-4ec3-95e7-d5e1ce3c4489'::uuid, 'Italie', 'IT'),
    ('80d9262a-efc3-496f-b841-fd825617a78b'::uuid, 'États-Unis', 'US'),
    ('bb10ac96-8eab-4139-a516-510d7aebc030'::uuid, 'États-Unis', 'US'),
    ('35ba3102-02f0-43d7-ab84-5fda79820bd4'::uuid, 'Nouvelle-Zélande', 'NZ'),
    ('45e70931-b6ff-44c0-9ea0-bcdef285ba43'::uuid, 'Espagne', 'ES'),
    ('449cdcca-3ff5-4e3a-b0ef-9fd880e666ce'::uuid, 'États-Unis', 'US'),
    ('69bb6a97-f2bf-40a5-a2f0-51a090745661'::uuid, 'Chili', 'CL'),
    ('0ff61a57-d605-4d7c-a247-2f87cb0b7d2c'::uuid, 'Andorre', 'AD'),
    ('2eface09-40ad-4428-ada0-9b9173455d00'::uuid, 'Suisse', 'CH'),
    ('7e418a3b-08fa-49d0-bb34-8a22c51ff17b'::uuid, 'Corée du Sud', 'KR'),
    ('80ab8ea8-f911-438f-8706-19acefbdd5ac'::uuid, 'Chine', 'CN'),
    ('ef18c3e4-9747-413c-90a7-2a1cb7da14f7'::uuid, 'États-Unis', 'US'),
    ('cba451ee-24a4-4b3e-8179-2d99ebbdff84'::uuid, 'Australie', 'AU'),
    ('17ce8e1c-8b46-411c-9d47-bfe0ef4ca00d'::uuid, 'Chine', 'CN'),
    ('bb5b0573-9612-46f9-87ce-a3506094b598'::uuid, 'Chine', 'CN'),
    ('54ba78b1-248a-42ad-a433-19ef389f6d1f'::uuid, 'Viêt Nam', 'VN'),
    ('f0ef890e-1d1e-432f-98bd-d3f0836d5a45'::uuid, 'Suisse', 'CH'),
    ('47f8a03c-9bf2-4923-b64f-2662d92adbb1'::uuid, 'Taïwan', 'TW'),
    ('b4619e0c-904a-41d6-99b3-70e16d4042cf'::uuid, 'Allemagne', 'DE')
)
update public.race_events as event
set location_country = source.country,
    location_country_code = source.country_code
from international_countries as source
where event.id = source.event_id
  and event.location_country_code is null
  and event.organizer_details -> 'catalogSource' ->> 'provider' = 'utmb';

do $$
declare
  complete_french_events integer;
  country_only_international_events integer;
begin
  select count(*)
  into complete_french_events
  from public.race_events
  where location_country_code = 'FR'
    and location_city_code is not null
    and location_department_code is not null
    and location_region_code is not null
    and location_latitude is not null
    and id in (
      '2c088707-9c68-4a13-be9f-a8c328959a3e', 'bec79481-b3d7-4a97-bde8-18a3abb54c08',
      '664f160a-76d7-434c-a805-5ba8690b3304', 'd2a49aca-0db5-4568-86df-77f7019059da',
      'c1c84901-ac29-4956-bc25-5788f0a5c7e5', 'ea5f1bec-ebb9-418a-9898-09250a35f108',
      'b6bd690c-14ac-4718-8512-030320f5868d', '53577181-6afd-4391-9ce9-cece40f39ad5',
      '5e328b3c-2301-4178-a0b0-30cfcb71505c', '60bdb000-b9ee-4dd8-8cbb-06b189db8f99',
      '08a81d9c-7682-4e6a-947d-9b17573dca92', '36d31dc1-4d2e-45c6-a176-caa6203e84ae',
      '67246343-be85-427e-961b-a72a02a0e59a', 'b7026aa5-7f15-46ea-9d60-1af0c7ae14b1',
      '3593fa6a-ee15-4236-85c0-a4cc1cecc9c7', '03bffad4-6d8f-4015-9e60-4f29753de239',
      '21aef1f3-567a-47a5-b7f9-fd72a7f540e0', '4611d361-52e1-46e9-9860-4b197448e416',
      'e0105312-c180-4924-87bd-7de6824dd87f', 'f7b6ebd5-0121-4a04-84cf-ff7a0c2a84c6',
      'bddc615a-1474-495c-9d77-315c58c02750', 'aab7ab38-eae1-4e2e-b6dd-6c57e6a04da0',
      '67ec35b6-be28-4742-9230-b994db613c20', 'fc02a808-53cb-46fc-8be0-ab8fa1d5e943',
      '0eec876e-bb5c-4bef-85f1-073904fad739', 'b669716c-c1a9-4d3b-bd1d-41203fa7ff98',
      'e4ce7df9-e819-461e-9142-6bb8f02e3642', 'b58585f6-109e-4381-89f8-69bfe9391c4a',
      '1a8752ae-d4fe-4582-9f45-dca312270115', '7a110000-0000-4000-8000-000000000001',
      '4372ed2d-947c-41a6-89e7-35de2660b013', 'e42a6bfc-a619-4db8-b6f9-0ff4018a21c8',
      '3449e400-cb7c-4462-9743-2c14ac683a89', '6625758f-f587-4de7-b243-d60b05aff092',
      '871a3177-8e8c-4f3f-96ef-00fc67a5c160', 'f3001eea-e766-4eeb-9dd3-a88944c5e06e'
    );

  if complete_french_events <> 36 then
    raise exception 'Expected 36 fully normalized French events, found %', complete_french_events;
  end if;

  select count(*)
  into country_only_international_events
  from public.race_events
  where location_country_code is not null
    and id in (
      '4f4ab461-bbe0-4e03-851b-73a46751c16d', '0c556cc2-7556-4508-8d91-5fcfd58ba36e',
      '4976d3d5-ecb9-4592-9b42-43d75abc2c24', 'd7482bbd-1442-470f-8b1f-6ac71283ebf8',
      'cf7ddee3-ca48-4fd3-95a3-d57204984224', '6ff39f72-4e5a-400e-9fe1-108624255336',
      '310fc52b-601f-4586-9d46-1425f1f6b865', 'd27bc902-3525-4346-9cec-5da411aef7c4',
      '032e62ea-8ed6-418d-a6f8-98c2fa082f60', 'fa0b393e-6f74-4e9a-b814-839ae06f4fd6',
      '39fd2b83-f4a0-4654-8538-f825045230b7', '7f1cbe60-55dd-442d-a071-8ff8906c1069',
      '17534bf1-4237-4d7d-8872-b66a15cb6651', '20999cd4-4828-4422-be03-b154ca494c45',
      'a5f16021-338c-49eb-9066-f6e5d57b6b80', 'a75bdb06-d911-45ce-9459-f490519453d5',
      '84c38478-b7b3-4307-9f89-8c3b103ecf05', '684cffed-7f66-4314-9ea6-63f754a8ec11',
      '940a32ef-0549-4a88-aa07-c7cc318e5d69', '290710aa-d9b9-4f87-b2d8-f8577b6f3c52',
      '3852af31-ea74-416b-a45e-18e41d1b7748', '1170e234-0898-4c6a-be2f-e4ec7bf4ea7b',
      '87f9219c-0f88-453b-a788-188a63977974', '2fa78236-6189-43bc-8b8e-2782a527afff',
      '1b5a5656-7004-47e4-afb4-9ff59902b624', '92285595-36f6-4ebf-aa8d-1cd205e61275',
      '674089bd-3feb-43e6-8902-baeb591afac2', '0a821055-7e30-4bbd-9ca7-dbf75348456b',
      '5bfc264c-5373-456d-bfba-9e82be09054f', 'f0f0411d-ea06-4373-9115-d47becc6fa0e',
      'f43abb91-45ea-4ee5-8456-cd61e7325162', 'c66c7973-13c7-4ec3-95e7-d5e1ce3c4489',
      '80d9262a-efc3-496f-b841-fd825617a78b', 'bb10ac96-8eab-4139-a516-510d7aebc030',
      '35ba3102-02f0-43d7-ab84-5fda79820bd4', '45e70931-b6ff-44c0-9ea0-bcdef285ba43',
      '449cdcca-3ff5-4e3a-b0ef-9fd880e666ce', '69bb6a97-f2bf-40a5-a2f0-51a090745661',
      '0ff61a57-d605-4d7c-a247-2f87cb0b7d2c', '2eface09-40ad-4428-ada0-9b9173455d00',
      '7e418a3b-08fa-49d0-bb34-8a22c51ff17b', '80ab8ea8-f911-438f-8706-19acefbdd5ac',
      'ef18c3e4-9747-413c-90a7-2a1cb7da14f7', 'cba451ee-24a4-4b3e-8179-2d99ebbdff84',
      '17ce8e1c-8b46-411c-9d47-bfe0ef4ca00d', 'bb5b0573-9612-46f9-87ce-a3506094b598',
      '54ba78b1-248a-42ad-a433-19ef389f6d1f', 'f0ef890e-1d1e-432f-98bd-d3f0836d5a45',
      '47f8a03c-9bf2-4923-b64f-2662d92adbb1', 'b4619e0c-904a-41d6-99b3-70e16d4042cf'
    );

  if country_only_international_events <> 50 then
    raise exception 'Expected 50 country-normalized international events, found %',
      country_only_international_events;
  end if;
end;
$$;
