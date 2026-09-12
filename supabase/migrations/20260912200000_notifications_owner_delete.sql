-- Kullanıcılar kendilerine gelen bildirimleri silebilsin.
--
-- notifications tablosunda yalnızca SELECT ve UPDATE politikaları vardı;
-- DELETE politikası olmadığı için RLS altında silme sessizce hiçbir satıra
-- dokunmuyordu. Politika sahiplik üzerinden kurulur (auth.uid() = user_id),
-- dolayısıyla müşteri, işletme ve sayfa yöneticisi ayrımı yapmadan herkes
-- yalnızca kendi bildirimlerini silebilir; başkasınınkine erişemez.

drop policy if exists "Users can delete own notifications" on public.notifications;

create policy "Users can delete own notifications"
  on public.notifications
  for delete
  to authenticated
  using (auth.uid() = user_id);
