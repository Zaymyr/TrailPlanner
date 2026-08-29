begin;

do $$
begin
  if not exists (
    select 1
    from public.race_events
    where id = '5e328b3c-2301-4178-a0b0-30cfcb71505c'
  ) then
    raise exception 'Amaz''Eaunes event not found; refusing to update another event.';
  end if;

  if (
    select count(*)
    from public.races
    where event_id = '5e328b3c-2301-4178-a0b0-30cfcb71505c'
      and id in (
        '7a815f5d-9f69-4ab9-b672-e82aaeac04e0',
        'ae2f5f46-75b9-4373-a851-b9a686a165d5',
        '986a6c65-70f7-4f78-8281-6eb27c041442',
        'af2359c5-a312-4644-8f9f-8dc6d7f73f56',
        '7b4f98a9-040b-4deb-b0a9-85f8ae250ff7'
      )
  ) <> 5 then
    raise exception 'Expected five Amaz''Eaunes 2026 formats; refusing a partial update.';
  end if;
end;
$$;

-- Temporarily widen the edition so the range and format-date guards allow the
-- five attached formats to move from the stale 11 September date to race day.
update public.race_event_editions
set start_date = least(start_date, date '2026-09-11'),
    end_date = greatest(end_date, date '2026-09-13')
where id = '2d1b10d3-f50f-4184-9585-6560a0531615'
  and event_id = '5e328b3c-2301-4178-a0b0-30cfcb71505c';

update public.races
set race_date = date '2026-09-13',
    organizer_details = coalesce(organizer_details, '{}'::jsonb)
      || jsonb_build_object(
        'schedule',
        coalesce(organizer_details -> 'schedule', '{}'::jsonb)
          || jsonb_build_object(
            'startTime', case id
              when '7b4f98a9-040b-4deb-b0a9-85f8ae250ff7'::uuid then '8h45'
              when 'af2359c5-a312-4644-8f9f-8dc6d7f73f56'::uuid then '9h45'
              when 'ae2f5f46-75b9-4373-a851-b9a686a165d5'::uuid then '9h50'
              when '986a6c65-70f7-4f78-8281-6eb27c041442'::uuid then '10h00'
              when '7a815f5d-9f69-4ab9-b672-e82aaeac04e0'::uuid then '10h15'
            end,
            'note', case id
              when '7b4f98a9-040b-4deb-b0a9-85f8ae250ff7'::uuid then 'Échauffement à 8h40 avec MyFitness Eaunes.'
              when 'af2359c5-a312-4644-8f9f-8dc6d7f73f56'::uuid then 'Échauffement à 9h40 avec MyFitness Eaunes.'
              when 'ae2f5f46-75b9-4373-a851-b9a686a165d5'::uuid then 'Échauffement à 9h40 avec Valérie Mothe.'
              when '986a6c65-70f7-4f78-8281-6eb27c041442'::uuid then 'Échauffement à 9h50 avec Valérie Mothe.'
              when '7a815f5d-9f69-4ab9-b672-e82aaeac04e0'::uuid then 'Échauffement à 9h50 avec Valérie Mothe.'
            end
          ),
        'access',
        coalesce(organizer_details -> 'access', '{}'::jsonb)
          || jsonb_build_object('overrideEnabled', false),
        'runnerInfo',
        coalesce(organizer_details -> 'runnerInfo', '{}'::jsonb)
          || jsonb_build_object(
            'startArea', 'Village Amaz’Eaunes — Salle Hermès, 145 avenue de la Mairie, 31600 Eaunes.',
            'rules', 'Apporter un gobelet personnel : aucun gobelet jetable n’est distribué aux ravitaillements. Porter le dossard devant et visible. Respecter le balisage, les signaleurs et le Code de la route sur les portions ouvertes. En cas d’abandon, prévenir un signaleur, un bénévole ou un poste de ravitaillement.',
            'note', 'Les parcours détaillés ne seront pas diffusés avant l’événement.'
          )
      )
where event_id = '5e328b3c-2301-4178-a0b0-30cfcb71505c'
  and id in (
    '7a815f5d-9f69-4ab9-b672-e82aaeac04e0',
    'ae2f5f46-75b9-4373-a851-b9a686a165d5',
    '986a6c65-70f7-4f78-8281-6eb27c041442',
    'af2359c5-a312-4644-8f9f-8dc6d7f73f56',
    '7b4f98a9-040b-4deb-b0a9-85f8ae250ff7'
  );

update public.race_event_editions
set start_date = date '2026-09-13',
    end_date = date '2026-09-13'
where id = '2d1b10d3-f50f-4184-9585-6560a0531615'
  and event_id = '5e328b3c-2301-4178-a0b0-30cfcb71505c';

update public.race_events
set name = 'Les Amaz’Eaunes',
    description = 'Événement sportif et solidaire au profit des femmes touchées par la maladie.',
    race_date = date '2026-09-13',
    organizer_details = coalesce(organizer_details, '{}'::jsonb)
      || jsonb_build_object(
        'dateRange', jsonb_build_object('endDate', '2026-09-13'),
        'mandatoryEquipment',
        coalesce(organizer_details -> 'mandatoryEquipment', '{}'::jsonb)
          || jsonb_build_object(
            'overrideEnabled', false,
            'weatherPlan', 'normal',
            'items', jsonb_build_array(
              jsonb_build_object(
                'id', 'amazeaunes-2026-personal-cup',
                'label', 'Gobelet personnel',
                'required', true,
                'cold', false,
                'heat', false,
                'note', 'Aucun gobelet jetable n’est distribué aux ravitaillements.'
              )
            ),
            'note', 'Prévoir également le dossard, une pièce d’identité et un antivol en cas de venue à vélo.'
          ),
        'bibPickup', jsonb_build_object(
          'overrideEnabled', false,
          'location', 'Super U Eaunes — 2 boulevard de la Lèze, ZAC du Mandarin, 31600 Eaunes',
          'locationDetails', jsonb_build_object(
            'label', 'Super U Eaunes — 2 boulevard de la Lèze, ZAC du Mandarin, 31600 Eaunes',
            'lat', null,
            'lng', null,
            'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=2%20boulevard%20de%20la%20L%C3%A8ze%2C%2031600%20Eaunes',
            'source', 'manual'
          ),
          'schedule', 'Dimanche 13 septembre dès 8h00, jusqu’à 15 min avant le départ de chaque épreuve.',
          'locations', jsonb_build_array(
            jsonb_build_object(
              'location', 'Super U Eaunes — 2 boulevard de la Lèze, ZAC du Mandarin, 31600 Eaunes',
              'locationDetails', jsonb_build_object(
                'label', 'Super U Eaunes — 2 boulevard de la Lèze, ZAC du Mandarin, 31600 Eaunes',
                'lat', null,
                'lng', null,
                'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=2%20boulevard%20de%20la%20L%C3%A8ze%2C%2031600%20Eaunes',
                'source', 'manual'
              ),
              'slots', jsonb_build_array(
                jsonb_build_object('date', '2026-09-11', 'startTime', '17:30', 'endTime', '19:30')
              )
            ),
            jsonb_build_object(
              'location', 'Decathlon Portet-sur-Garonne — 4 avenue des Palanques, 31120 Portet-sur-Garonne',
              'locationDetails', jsonb_build_object(
                'label', 'Decathlon Portet-sur-Garonne — 4 avenue des Palanques, 31120 Portet-sur-Garonne',
                'lat', null,
                'lng', null,
                'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=4%20avenue%20des%20Palanques%2C%2031120%20Portet-sur-Garonne',
                'source', 'manual'
              ),
              'slots', jsonb_build_array(
                jsonb_build_object('date', '2026-09-12', 'startTime', '09:00', 'endTime', '13:00')
              )
            ),
            jsonb_build_object(
              'location', 'Salle Hermès — 145 avenue de la Mairie, 31600 Eaunes',
              'locationDetails', jsonb_build_object(
                'label', 'Salle Hermès — 145 avenue de la Mairie, 31600 Eaunes',
                'lat', null,
                'lng', null,
                'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=145%20avenue%20de%20la%20Mairie%2C%2031600%20Eaunes',
                'source', 'manual'
              ),
              'slots', jsonb_build_array(
                jsonb_build_object('date', '2026-09-12', 'startTime', '14:00', 'endTime', '17:00'),
                jsonb_build_object('date', '2026-09-13', 'startTime', '08:00', 'endTime', null)
              )
            )
          ),
          'requiredDocuments', 'Pièce d’identité obligatoire. Pour retirer le dossard d’une autre personne, présenter une copie de sa pièce d’identité ; la version numérique est acceptée.',
          'thirdPartyPickupAllowed', true,
          'equipmentCheck', false,
          'note', 'Prévoir une ceinture porte-dossard ou des épingles. Le dossard doit être porté devant et rester visible. Privilégier si possible le retrait du vendredi ou du samedi.'
        ),
        'access',
        coalesce(organizer_details -> 'access', '{}'::jsonb)
          || jsonb_build_object(
            'overrideEnabled', false,
            'startAddress', 'Village Amaz’Eaunes — Salle Hermès, 145 avenue de la Mairie, 31600 Eaunes',
            'startLocation', jsonb_build_object(
              'label', 'Salle Hermès — 145 avenue de la Mairie, 31600 Eaunes',
              'lat', null,
              'lng', null,
              'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=145%20avenue%20de%20la%20Mairie%2C%2031600%20Eaunes',
              'source', 'manual'
            ),
            'finishAddress', 'Village Amaz’Eaunes — Salle Hermès, 145 avenue de la Mairie, 31600 Eaunes',
            'finishLocation', jsonb_build_object(
              'label', 'Salle Hermès — 145 avenue de la Mairie, 31600 Eaunes',
              'lat', null,
              'lng', null,
              'googleMapsUrl', 'https://www.google.com/maps/search/?api=1&query=145%20avenue%20de%20la%20Mairie%2C%2031600%20Eaunes',
              'source', 'manual'
            ),
            'officialParkings', 'Ouverts : parking de la Mairie et parking de l’Abbaye. Fermés : parking de la Salle Hermès et parking de l’école Jean-Dargassies / Bicentenaire. Ne pas stationner sur les parkings réservés aux commerces.',
            'shuttles', null,
            'shuttleSchedule', null,
            'roadRestrictions', 'Plusieurs voies autour de la Salle Hermès et des accès à la forêt seront fermées ou réglementées pendant les épreuves. Les restrictions sont prévues jusqu’à 14h00 maximum, avec une réouverture progressive possible. La signalisation et les consignes des signaleurs priment sur l’horaire théorique.',
            'mapUrl', null,
            'note', 'Privilégier le covoiturage. Des racks vélo sont disponibles aux parkings de l’Abbaye, du Bicentenaire et Olympe ; prévoir un antivol, les emplacements ne sont pas surveillés.',
            'enabledSections', jsonb_build_object(
              'officialParkings', true,
              'shuttles', false,
              'roadRestrictions', true,
              'mapUrl', false,
              'runnerInfo', true
            )
          ),
        'services',
        coalesce(organizer_details -> 'services', '{}'::jsonb)
          || jsonb_build_object(
            'supporters', 'Garderie gratuite EMA Nounou Muret pour les enfants de 3 à 12 ans, sur inscription obligatoire avant le 7 septembre 2026. Aucune inscription sur place. Contact : contact.muret@ema.family.',
            'restaurants', 'Village Amaz’Eaunes avec trois foodtrucks : HTBon, Mamouth Burger et Gaufre Joly, ainsi qu’une buvette.',
            'lastMinuteMessage', 'Apporter un gobelet personnel : aucun gobelet jetable ne sera distribué. Les parcours détaillés ne seront pas diffusés avant l’événement.',
            'note', 'Une zone de dépôt d’effets personnels non surveillée est disponible à la Salle Hermès : ne laisser aucun objet de valeur. Des ravitaillements avec eau et encas sucrés/salés sont prévus selon les épreuves et à l’arrivée. Des écocups seront en vente à la buvette dès 8h.'
          )
      )
where id = '5e328b3c-2301-4178-a0b0-30cfcb71505c';

commit;
