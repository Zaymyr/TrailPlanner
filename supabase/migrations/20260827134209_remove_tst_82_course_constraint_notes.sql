update public.races
set organizer_details = organizer_details
  #- '{schedule,cutoffNote}'
  #- '{schedule,note}'
where id = '7a110000-0000-4000-8000-000000000082'
  and (
    organizer_details #>> '{schedule,cutoffNote}' is not null
    or organizer_details #>> '{schedule,note}' is not null
  );
